import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { S3Client, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.556.0';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.556.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  dokumenId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body: RequestBody = await req.json();
    const { dokumenId } = body;

    if (!dokumenId) {
      throw new Error('dokumenId is required');
    }

    const { data: userDokumen, error: docError } = await supabaseClient
      .from('user_dokumen')
      .select('file_path, user_id')
      .eq('id', dokumenId)
      .single();

    if (docError || !userDokumen) {
      throw new Error('Document not found');
    }

    const { data: userRoleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRoleData?.role === 'admin_bkd';
    const isOwner = userDokumen.user_id === user.id;

    if (!isAdmin && !isOwner) {
      throw new Error('Access denied');
    }

    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 credentials');
      throw new Error('R2 configuration error');
    }

    let fileKey = userDokumen.file_path;
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');
    
    if (publicUrl && fileKey.startsWith(publicUrl)) {
      fileKey = fileKey.replace(publicUrl + '/', '');
    }

    console.log('Generating presigned URL for file:', fileKey);

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    console.log('Presigned URL generated successfully');

    return new Response(
      JSON.stringify({ presignedUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.583.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteRequest {
  userDokumenId: string;
}

// Helper function to create S3 client for R2
function createR2Client() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const endpoint = Deno.env.get('R2_ENDPOINT');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials');
  }

  return new S3Client({
    region: 'auto',
    endpoint: endpoint || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Delete request from user:', user.id);

    const { userDokumenId } = await req.json() as DeleteRequest;

    // Get document info
    const { data: userDoc, error: docError } = await supabase
      .from('user_dokumen')
      .select('file_path, user_id')
      .eq('id', userDokumenId)
      .maybeSingle();

    if (docError || !userDoc) {
      throw new Error('Document not found');
    }

    // Verify ownership
    if (userDoc.user_id !== user.id) {
      throw new Error('Unauthorized to delete this document');
    }

    // Get R2 configuration
    const bucketName = Deno.env.get('R2_BUCKET_NAME');
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');

    if (!bucketName || !publicUrl) {
      throw new Error('Missing R2 configuration');
    }

    // Extract file path from URL
    const filePath = userDoc.file_path.replace(publicUrl + '/', '');
    if (!filePath) {
      throw new Error('Invalid file path');
    }

    // Create R2 client
    const r2Client = createR2Client();

    // Delete from R2
    console.log('Deleting file from R2:', filePath);
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: filePath,
    });

    await r2Client.send(deleteCommand);
    console.log('File deleted from R2');

    // Delete from database
    const { error: deleteError } = await supabase
      .from('user_dokumen')
      .delete()
      .eq('id', userDokumenId);

    if (deleteError) throw deleteError;
    console.log('Document deleted from database');

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in delete-from-r2:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

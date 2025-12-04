import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  dokumenId: string;
}

// AWS Signature V4 helper for presigned URLs
async function createPresignedUrl(
  method: string,
  url: URL,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  expiresIn: number = 300
): Promise<string> {
  const encoder = new TextEncoder();
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 's3';

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  // Build query parameters for presigned URL
  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'host',
  });

  // Create canonical request
  const canonicalUri = url.pathname;
  const canonicalQuerystring = queryParams.toString().split('&').sort().join('&');
  const canonicalHeaders = `host:${url.host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Create string to sign
  const canonicalRequestHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
  const canonicalRequestHash = Array.from(new Uint8Array(canonicalRequestHashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Calculate signature using HMAC
  async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  }

  let key: ArrayBuffer = encoder.encode(`AWS4${secretAccessKey}`).buffer as ArrayBuffer;
  key = await hmac(key, dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, service);
  key = await hmac(key, 'aws4_request');
  const signatureArray = await hmac(key, stringToSign);
  const signature = Array.from(new Uint8Array(signatureArray))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Build final presigned URL
  queryParams.append('X-Amz-Signature', signature);
  return `${url.origin}${url.pathname}?${queryParams.toString()}`;
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
      console.error('Auth error:', userError?.message || 'No user found');
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

    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const objectUrl = new URL(`/${bucketName}/${fileKey}`, r2Endpoint);

    const presignedUrl = await createPresignedUrl(
      'GET',
      objectUrl,
      accessKeyId,
      secretAccessKey,
      'auto',
      300 // 5 minutes expiry
    );

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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  dokumenId: string;
}

// AWS Signature V4 helper
async function createAwsSignature(
  method: string,
  url: URL,
  headers: Record<string, string>,
  payload: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = 'auto'
) {
  const encoder = new TextEncoder();
  
  async function hmac(key: Uint8Array | string, data: string): Promise<Uint8Array> {
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      (keyData as unknown) as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
    return new Uint8Array(signature);
  }

  async function hash(data: string): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  headers['x-amz-date'] = amzDate;

  const canonicalUri = url.pathname;
  const canonicalQuerystring = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key}:${headers[key]}\n`)
    .join('');

  const payloadHash = await hash(payload);

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await hash(canonicalRequest),
  ].join('\n');

  let key = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, 's3');
  key = await hmac(key, 'aws4_request');
  const signature = Array.from(await hmac(key, stringToSign))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return authorizationHeader;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { dokumenId } = body;

    if (!dokumenId) {
      throw new Error('dokumenId is required');
    }

    // Verify user has access to this document
    const { data: userDokumen, error: docError } = await supabaseClient
      .from('user_dokumen')
      .select('file_path, dokumen_id, user_id')
      .eq('id', dokumenId)
      .single();

    if (docError || !userDokumen) {
      throw new Error('Document not found');
    }

    // Check if user is admin or document owner
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRole?.role === 'admin_bkd';
    const isOwner = userDokumen.user_id === user.id;

    if (!isAdmin && !isOwner) {
      throw new Error('Access denied');
    }

    // Get R2 credentials
    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 credentials');
      throw new Error('R2 configuration error');
    }

    // Extract file key from R2 public URL or use file_path directly
    let fileKey = userDokumen.file_path;
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');
    
    if (publicUrl && fileKey.startsWith(publicUrl)) {
      // Extract key from public URL
      fileKey = fileKey.replace(publicUrl + '/', '');
    }

    console.log('Generating presigned URL for file:', fileKey);

    // Generate presigned URL (valid for 5 minutes)
    const expiresIn = 300; // 5 minutes
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const url = new URL(`/${bucketName}/${fileKey}`, endpoint);
    
    // Add query parameters for presigned URL
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', `${accessKeyId}/${credentialScope}`);
    url.searchParams.set('X-Amz-Date', amzDate);
    url.searchParams.set('X-Amz-Expires', expiresIn.toString());
    url.searchParams.set('X-Amz-SignedHeaders', 'host');

    // Create canonical request for presigned URL
    const canonicalRequest = [
      'GET',
      `/${bucketName}/${fileKey}`,
      Array.from(url.searchParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&'),
      `host:${url.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    // Hash canonical request
    const encoder = new TextEncoder();
    const canonicalRequestHash = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(canonicalRequest)
    );
    const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create string to sign
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHashHex,
    ].join('\n');

    // Generate signature
    async function hmac(key: Uint8Array | string, data: string): Promise<Uint8Array> {
      const keyData = typeof key === 'string' ? encoder.encode(key) : key;
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        (keyData as unknown) as ArrayBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
      return new Uint8Array(signature);
    }

    let key = await hmac(`AWS4${secretAccessKey}`, dateStamp);
    key = await hmac(key, 'auto');
    key = await hmac(key, 's3');
    key = await hmac(key, 'aws4_request');
    const signatureBytes = await hmac(key, stringToSign);
    const signature = Array.from(signatureBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Add signature to URL
    url.searchParams.set('X-Amz-Signature', signature);

    const presignedUrl = url.toString();

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

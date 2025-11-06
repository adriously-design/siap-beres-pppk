import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteRequest {
  userDokumenId: string;
}

// AWS Signature V4 helper
async function createAwsSignature(
  method: string,
  url: URL,
  headers: Record<string, string>,
  payload: Uint8Array,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<Record<string, string>> {
  const encoder = new TextEncoder();
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 's3';
  
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  
  // Create canonical request
  const canonicalUri = url.pathname;
  const canonicalQuerystring = '';
  
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort()
    .map(key => `${key}:${headers[key]}\n`)
    .join('');
  
  // Hash payload
  const payloadBuffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) as ArrayBuffer;
  const payloadHashBuffer = await crypto.subtle.digest('SHA-256', payloadBuffer);
  const payloadHash = Array.from(new Uint8Array(payloadHashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
  const canonicalRequestHash = Array.from(new Uint8Array(canonicalRequestHashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');
  
  // Calculate signature
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
  
  let key: ArrayBuffer = encoder.encode(`AWS4${secretAccessKey}`).buffer;
  key = await hmac(key, dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, service);
  key = await hmac(key, 'aws4_request');
  const signatureArray = await hmac(key, stringToSign);
  const signature = Array.from(new Uint8Array(signatureArray))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    ...headers,
    'Authorization': authorization,
    'x-amz-date': amzDate,
  };
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
    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME');
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      throw new Error('Missing R2 configuration');
    }

    // Extract file path from URL
    const filePath = userDoc.file_path.replace(publicUrl + '/', '');
    if (!filePath) {
      throw new Error('Invalid file path');
    }

    console.log('Deleting file from R2:', filePath);

    // Delete from R2 using AWS Signature V4
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const url = new URL(`/${bucketName}/${filePath}`, endpoint);
    
    const headers: Record<string, string> = {
      'host': url.host,
    };
    
    const signedHeaders = await createAwsSignature(
      'DELETE',
      url,
      headers,
      new Uint8Array(0),
      accessKeyId,
      secretAccessKey,
      'auto'
    );

    const deleteResponse = await fetch(url.toString(), {
      method: 'DELETE',
      headers: signedHeaders,
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const errorText = await deleteResponse.text();
      console.error('R2 delete error:', errorText);
      throw new Error(`Failed to delete from R2: ${deleteResponse.status}`);
    }

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

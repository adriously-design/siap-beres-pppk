import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  fileName: string;
  fileBase64: string;
  mimeType: string;
  dokumenId: string;
  fileSizeKb: number;
  userNote?: string;
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

    console.log('Upload request from user:', user.id);

    const { fileName, fileBase64, mimeType, dokumenId, fileSizeKb, userNote } = await req.json() as UploadRequest;

    // Get R2 configuration
    const accountId = Deno.env.get('R2_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME');
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      throw new Error('Missing R2 configuration');
    }

    // Generate unique file path
    const timestamp = new Date().getTime();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `dokumen/${user.id}/${timestamp}_${sanitizedFileName}`;

    // Convert base64 to binary
    const binaryData = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));

    console.log('Uploading file to R2...');
    
    // Prepare R2 upload using AWS Signature V4
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const url = new URL(`/${bucketName}/${filePath}`, endpoint);
    
    const headers: Record<string, string> = {
      'host': url.host,
      'content-type': mimeType,
      'content-length': binaryData.length.toString(),
    };
    
    const signedHeaders = await createAwsSignature(
      'PUT',
      url,
      headers,
      binaryData,
      accessKeyId,
      secretAccessKey,
      'auto'
    );

    const uploadResponse = await fetch(url.toString(), {
      method: 'PUT',
      headers: signedHeaders,
      body: binaryData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('R2 upload error:', errorText);
      throw new Error(`Failed to upload to R2: ${uploadResponse.status} ${errorText}`);
    }

    console.log('File uploaded to R2:', filePath);

    // Generate public URL
    const filePublicUrl = `${publicUrl}/${filePath}`;

    // Check if user already has this document
    const { data: existingDoc } = await supabase
      .from('user_dokumen')
      .select('id, file_path, catatan_history')
      .eq('user_id', user.id)
      .eq('dokumen_id', dokumenId)
      .maybeSingle();

    if (existingDoc) {
      // Delete old file from R2 if exists
      if (existingDoc.file_path) {
        const oldFilePath = existingDoc.file_path.replace(publicUrl + '/', '');
        try {
          const deleteUrl = new URL(`/${bucketName}/${oldFilePath}`, endpoint);
          const deleteHeaders: Record<string, string> = {
            'host': deleteUrl.host,
          };
          
          const signedDeleteHeaders = await createAwsSignature(
            'DELETE',
            deleteUrl,
            deleteHeaders,
            new Uint8Array(0),
            accessKeyId,
            secretAccessKey,
            'auto'
          );

          await fetch(deleteUrl.toString(), {
            method: 'DELETE',
            headers: signedDeleteHeaders,
          });
          console.log('Old file deleted from R2');
        } catch (e) {
          console.error('Failed to delete old file:', e);
        }
      }

      const existingHistory = Array.isArray(existingDoc.catatan_history) ? existingDoc.catatan_history : [];
      const newHistory = userNote?.trim() 
        ? [
            ...existingHistory,
            {
              type: 'user',
              message: userNote,
              timestamp: new Date().toISOString()
            }
          ]
        : existingHistory;

      // Update existing record
      const { error: updateError } = await supabase
        .from('user_dokumen')
        .update({
          file_name: fileName,
          file_path: filePublicUrl,
          file_size_kb: fileSizeKb,
          status_verifikasi: 'pending',
          uploaded_at: new Date().toISOString(),
          catatan_admin: null,
          catatan_user: userNote || null,
          catatan_history: newHistory,
          verified_at: null,
        })
        .eq('id', existingDoc.id);

      if (updateError) throw updateError;
      console.log('Document updated in database');
    } else {
      // Insert new record
      const historyEntry = userNote?.trim() ? [{
        type: 'user',
        message: userNote,
        timestamp: new Date().toISOString()
      }] : [];

      const { error: insertError } = await supabase
        .from('user_dokumen')
        .insert({
          user_id: user.id,
          dokumen_id: dokumenId,
          file_name: fileName,
          file_path: filePublicUrl,
          file_size_kb: fileSizeKb,
          status_verifikasi: 'pending',
          catatan_user: userNote || null,
          catatan_history: historyEntry,
        });

      if (insertError) throw insertError;
      console.log('Document inserted into database');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        filePath,
        publicUrl: filePublicUrl,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in upload-to-r2:', error);
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

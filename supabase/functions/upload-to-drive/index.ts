import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.583.0";

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

    console.log('Upload request from user:', user.id);

    const { fileName, fileBase64, mimeType, dokumenId, fileSizeKb, userNote } = await req.json() as UploadRequest;

    // Get R2 configuration
    const bucketName = Deno.env.get('R2_BUCKET_NAME');
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');

    if (!bucketName || !publicUrl) {
      throw new Error('Missing R2 configuration');
    }

    // Create R2 client
    const r2Client = createR2Client();

    // Generate unique file path
    const timestamp = new Date().getTime();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `dokumen/${user.id}/${timestamp}_${sanitizedFileName}`;

    // Convert base64 to binary
    const binaryData = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));

    console.log('Uploading file to R2...');
    // Upload to R2
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: binaryData,
      ContentType: mimeType,
    });

    await r2Client.send(putCommand);
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
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldFilePath,
          });
          await r2Client.send(deleteCommand);
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

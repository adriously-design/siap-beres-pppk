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

    const { fileName, fileBase64, mimeType, dokumenId, fileSizeKb, userNote } = await req.json() as UploadRequest;

    // Get Google Drive credentials
    const folderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!folderId || !serviceAccountEmail || !privateKey) {
      throw new Error('Missing Google Drive configuration');
    }

    // Create JWT for Google API
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    // Import crypto for signing
    const encoder = new TextEncoder();
    const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signatureInput = `${headerBase64}.${payloadBase64}`;
    
    // Import private key
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKey.substring(
      pemHeader.length,
      privateKey.length - pemFooter.length
    ).trim();
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(signatureInput)
    );

    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const jwtToken = `${signatureInput}.${signatureBase64}`;

    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`,
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const { access_token } = await tokenResponse.json();

    // Upload to Google Drive
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: mimeType
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    const metadataPart = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata);
    
    // Decode base64 to binary
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const filePart = delimiter + `Content-Type: ${mimeType}\r\n` + 'Content-Transfer-Encoding: base64\r\n\r\n' + fileBase64;

    const multipartRequestBody = metadataPart + filePart + closeDelim;

    const driveResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      throw new Error(`Failed to upload to Google Drive: ${errorText}`);
    }

    const driveFile = await driveResponse.json();
    const fileId = driveFile.id;
    
    // Make file publicly accessible
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });

    // Generate public URL
    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    // Check if user already has this document
    const { data: existingDoc } = await supabase
      .from('user_dokumen')
      .select('id, file_path, catatan_history')
      .eq('user_id', user.id)
      .eq('dokumen_id', dokumenId)
      .single();

    if (existingDoc) {
      // If exists, try to delete old file from Google Drive (extract fileId from old path)
      const oldFileId = existingDoc.file_path.match(/id=([^&]+)/)?.[1];
      if (oldFileId) {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${oldFileId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${access_token}`,
            },
          });
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
          file_path: publicUrl,
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
          file_path: publicUrl,
          file_size_kb: fileSizeKb,
          status_verifikasi: 'pending',
          catatan_user: userNote || null,
          catatan_history: historyEntry,
        });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileId,
        publicUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

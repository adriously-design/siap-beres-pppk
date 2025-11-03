import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  no_peserta: string;
  nik: string;
  new_password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { no_peserta, nik, new_password }: ResetPasswordRequest = await req.json();

    // Validate input
    if (!no_peserta || !nik || !new_password) {
      return new Response(
        JSON.stringify({ error: 'No Peserta, NIK, dan password baru harus diisi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate NIK format (16 digits)
    if (!/^\d{16}$/.test(nik)) {
      return new Response(
        JSON.stringify({ error: 'NIK harus 16 digit angka' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password minimal 8 karakter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if user exists with matching no_peserta AND nik
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, no_peserta, nik, full_name, status_aktivasi, jabatan, phone')
      .eq('no_peserta', no_peserta)
      .eq('nik', nik);

    if (profileError) {
      console.log('Profile query error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Terjadi kesalahan sistem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log('Profile not found for no_peserta:', no_peserta, 'nik:', nik);
      return new Response(
        JSON.stringify({ error: 'No Peserta atau NIK tidak sesuai' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = profiles[0];

    // --- PERBAIKAN LOGIKA DIMULAI DI SINI ---

    // Baik itu aktivasi pertama kali atau reset, pengguna auth diasumsikan sudah ada
    // (berdasarkan 'profile.id' yang seharusnya merupakan ID pengguna auth).
    // Kita hanya perlu update password mereka.
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Error updating password (reset/activation):', updateError);
      return new Response(
        JSON.stringify({ error: `Gagal mengubah password: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tentukan pesan balasan SEBELUM kita update status
    const wasActivated = profile.status_aktivasi;
    const message = wasActivated
      ? 'Password berhasil diubah. Silahkan login dengan password baru.'
      : 'Akun berhasil diaktifkan! Silahkan login dengan No Peserta dan password baru Anda.';

    // Jika ini adalah aktivasi pertama kali (status_aktivasi false),
    // update status di tabel profiles SEKARANG.
    if (!wasActivated) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ status_aktivasi: true })
        .eq('id', profile.id); // Update profil yang sesuai

      if (profileUpdateError) {
        console.error('Password updated, but failed to set status_aktivasi:', profileUpdateError);
        // Ini tidak fatal, user bisa login, tapi statusnya masih false
        // Kita tetap kirim sukses tapi catat errornya di log server
      }
    }

    console.log(`Password updated/activated for user: ${profile.id}`);
        
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: message,
        activated: !wasActivated // Kirim true jika INI adalah proses aktivasi
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // --- PERBAIKAN LOGIKA SELESAI ---

  } catch (error) {
    console.error('Error in reset-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);

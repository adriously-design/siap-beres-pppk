// GANTI SELURUH ISI file: functions/reset-password/index.ts
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

    // Validasi input dasar
    if (!no_peserta || !nik || !new_password) {
      return new Response(
        JSON.stringify({ error: 'No Peserta, NIK, dan password baru harus diisi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/^\d{16}$/.test(nik)) {
      return new Response(
        JSON.stringify({ error: 'NIK harus 16 digit angka' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password minimal 8 karakter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buat admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Cari profil di tabel 'profiles'
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, no_peserta, nik, full_name, status_aktivasi')
      .eq('no_peserta', no_peserta)
      .eq('nik', nik);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No Peserta atau NIK tidak sesuai' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = profiles[0];

    // --- INI LOGIKA YANG DIPERBAIKI ---

    if (profile.status_aktivasi) {
      // KASUS 1: AKUN SUDAH AKTIF (Hanya reset password)
      // Kita asumsikan profile.id adalah auth.user.id yang valid
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password: new_password }
      );

      if (updateError) {
        console.error('Error updating password (user aktif):', updateError);
        return new Response(
          JSON.stringify({ error: 'Gagal mengubah password. ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password updated for existing user:', profile.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Password berhasil diubah. Silahkan login dengan password baru.',
          activated: true // Tidak ada aktivasi baru
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // KASUS 2: AKTIVASI PERTAMA KALI (Akun belum aktif)
      // Buat pengguna baru di auth.users
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: `${no_peserta}@pppk.bkd.ntt.go.id`, // Email unik
        password: new_password,
        email_confirm: true, // Langsung aktifkan email
        user_metadata: {
          full_name: profile.full_name,
          no_peserta: profile.no_peserta,
          nik: profile.nik,
          role: 'calon_pppk'
        }
      });

      if (createError) {
        console.error('Error creating user (aktivasi):', createError);
        return new Response(
          JSON.stringify({ error: 'Gagal membuat akun. ' + createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // PENTING: Update tabel 'profiles' secara manual
      // Sinkronkan ID dan set status_aktivasi = true
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          id: newUser.user.id, // Sinkronkan ID profil dengan ID auth
          status_aktivasi: true
        })
        .eq('no_peserta', no_peserta); // Cari berdasarkan no_peserta

      if (profileUpdateError) {
        console.error('User auth dibuat, TAPI GAGAL update profil:', profileUpdateError);
        // Jika ini gagal, user auth tetap dibuat, tapi status aktivasi di profil masih false
        // Ini adalah error kritis yang perlu ditangani, tapi kita tetap beri tahu user
        return new Response(
          JSON.stringify({ error: 'Gagal sinkronisasi profil, hubungi admin. ' + profileUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('First time activation successful for user:', newUser.user.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Akun berhasil diaktifkan! Silahkan login dengan No Peserta dan password baru Anda.',
          activated: false // Ini adalah proses aktivasi (wasActivated = false)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- AKHIR LOGIKA PERBAIKAN ---

  } catch (error) {
    console.error('Error in reset-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan server: ' + (error instanceof Error ? error.message : 'Unknown error') }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);

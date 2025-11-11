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

// Helper function untuk sanitize error messages
function getSafeErrorMessage(error: any): string {
  const message = error?.message?.toLowerCase() || '';
  if (message.includes('rate') || message.includes('too many')) {
    return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
  }
  if (message.includes('not found') || message.includes('invalid')) {
    return 'Data tidak ditemukan atau tidak valid.';
  }
  return 'Terjadi kesalahan sistem. Silakan coba lagi.';
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
        JSON.stringify({ error: 'Format data tidak valid' }),
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

    // ============ RATE LIMITING ============
    // Identifier: kombinasi NIK + no_peserta untuk mencegah brute force
    const rateLimitIdentifier = `reset-pwd:${nik}:${no_peserta}`;
    
    console.log(`Rate limit check for: ${rateLimitIdentifier}`);
    
    const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: rateLimitIdentifier,
      p_endpoint: 'reset-password',
      p_max_attempts: 3, // Hanya 3 percobaan
      p_window_minutes: 60 // Per 60 menit (1 jam)
    });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      // Tetap lanjutkan jika rate limit check gagal (fail-open untuk availability)
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for: ${rateLimitIdentifier}`);
      return new Response(
        JSON.stringify({ 
          error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
          reset_at: rateLimitResult.reset_at
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Rate limit passed. Attempts remaining: ${rateLimitResult?.attempts_remaining}`);

    // ============ VERIFIKASI KREDENSIAL DENGAN SECURITY DEFINER FUNCTION ============
    // Menggunakan function yang hanya return boolean, tidak expose PII
    const { data: isValid, error: verifyError } = await supabaseAdmin.rpc('verify_credentials', {
      p_no_peserta: no_peserta,
      p_nik: nik
    });

    if (verifyError) {
      console.error('Credential verification error:', verifyError);
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage(verifyError) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValid) {
      console.log('Invalid credentials provided');
      return new Response(
        JSON.stringify({ error: 'Data tidak ditemukan atau tidak sesuai' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Credentials verified successfully');

    // Ambil data profile untuk keperluan aktivasi (setelah verifikasi berhasil)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, no_peserta, full_name, status_aktivasi')
      .eq('no_peserta', no_peserta)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage(profileError) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          JSON.stringify({ error: getSafeErrorMessage(updateError) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password updated for existing user:', profile.id);
      
      // TODO: Kirim notifikasi email ke user bahwa password berhasil diubah
      // Memerlukan integrasi dengan Resend atau SMTP
      
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
          nik: nik, // Gunakan NIK dari input (sudah divalidasi)
          role: 'calon_pppk'
        }
      });

      if (createError) {
        console.error('Error creating user (aktivasi):', createError);
        return new Response(
          JSON.stringify({ error: getSafeErrorMessage(createError) }),
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
        return new Response(
          JSON.stringify({ error: getSafeErrorMessage(profileUpdateError) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('First time activation successful for user:', newUser.user.id);
      
      // TODO: Kirim notifikasi email selamat datang
      // Memerlukan integrasi dengan Resend atau SMTP
      
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
      JSON.stringify({ error: getSafeErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);

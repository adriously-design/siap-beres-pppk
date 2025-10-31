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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, no_peserta, nik, full_name, status_aktivasi, jabatan, phone')
      .eq('no_peserta', no_peserta)
      .eq('nik', nik)
      .single();

    if (profileError || !profile) {
      console.log('Profile not found or error:', profileError);
      return new Response(
        JSON.stringify({ error: 'No Peserta atau NIK tidak sesuai' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already activated
    if (profile.status_aktivasi) {
      // User already has account, just update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password: new_password }
      );

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Gagal mengubah password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password updated for existing user:', profile.id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Password berhasil diubah. Silahkan login dengan password baru.',
          user_exists: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First time activation - create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: `${no_peserta}@pppk.bkd.ntt.go.id`,
      password: new_password,
      email_confirm: true,
      user_metadata: {
        full_name: profile.full_name,
        no_peserta: profile.no_peserta,
        nik: profile.nik,
        role: 'calon_pppk'
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: 'Gagal membuat akun. ' + createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete old profile and insert new one with auth user ID
    // First, save the old profile data
    const oldProfileData = {
      full_name: profile.full_name,
      no_peserta: profile.no_peserta,
      nik: profile.nik,
      jabatan: profile.jabatan,
      phone: profile.phone
    };

    // Delete old profile entry
    const { error: deleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('no_peserta', no_peserta)
      .eq('nik', nik);

    if (deleteError) {
      console.error('Error deleting old profile:', deleteError);
      // Rollback - delete created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Gagal mengaktifkan akun (delete)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new profile with auth user ID
    const { error: insertProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({ 
        id: newUser.user.id,
        ...oldProfileData,
        status_aktivasi: true
      });

    if (insertProfileError) {
      console.error('Error inserting new profile:', insertProfileError);
      // Rollback - delete created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Gagal mengaktifkan akun (insert)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('First time activation successful for user:', newUser.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Akun berhasil diaktifkan! Silahkan login dengan No Peserta dan password baru Anda.',
        user_exists: false,
        no_peserta: profile.no_peserta
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Terjadi kesalahan server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);

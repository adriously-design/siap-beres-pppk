import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserData {
  no_peserta: string;
  nik: string;
  full_name: string;
  role?: 'calon_pppk' | 'admin_bkd';
}

// Generate a strong random password
function generateStrongPassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }
  return password;
}

// Validate and sanitize user input
function validateAndSanitize(userData: UserData): { valid: boolean; error?: string; sanitized?: UserData } {
  // Validate no_peserta
  if (!userData.no_peserta || userData.no_peserta.trim().length === 0) {
    return { valid: false, error: 'No Peserta harus diisi' };
  }
  if (userData.no_peserta.length > 50) {
    return { valid: false, error: 'No Peserta terlalu panjang (max 50 karakter)' };
  }

  // Validate NIK - must be exactly 16 digits
  const nikRegex = /^\d{16}$/;
  if (!userData.nik || !nikRegex.test(userData.nik)) {
    return { valid: false, error: 'NIK harus 16 digit angka' };
  }

  // Validate and sanitize full_name
  if (!userData.full_name || userData.full_name.trim().length === 0) {
    return { valid: false, error: 'Nama lengkap harus diisi' };
  }
  if (userData.full_name.length > 100) {
    return { valid: false, error: 'Nama terlalu panjang (max 100 karakter)' };
  }

  // Remove potentially dangerous characters from name
  const sanitizedName = userData.full_name
    .replace(/[<>\"']/g, '') // Remove XSS characters
    .replace(/[;]/g, '') // Remove SQL injection characters
    .trim();

  return {
    valid: true,
    sanitized: {
      no_peserta: userData.no_peserta.trim(),
      nik: userData.nik,
      full_name: sanitizedName,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: hasAdminRole } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin_bkd' });

    if (!hasAdminRole) {
      console.error('User does not have admin role');
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userData, userId, role, email, password, verification_key } = await req.json();

    switch (action) {
      case 'create_admin': {
        // Verify the verification key from environment
        const ADMIN_VERIFICATION_KEY = Deno.env.get('ADMIN_VERIFICATION_KEY');
        
        if (!ADMIN_VERIFICATION_KEY) {
          console.error('ADMIN_VERIFICATION_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (verification_key !== ADMIN_VERIFICATION_KEY) {
          return new Response(
            JSON.stringify({ error: 'Kata kunci verifikasi salah' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate email
        if (!email || !email.includes('@')) {
          return new Response(
            JSON.stringify({ error: 'Email tidak valid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate password
        if (!password || password.length < 8) {
          return new Response(
            JSON.stringify({ error: 'Password minimal 8 karakter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: email.split('@')[0], // Use email prefix as name
          },
        });

        if (authError) {
          console.error('Error creating admin:', authError);
          return new Response(
            JSON.stringify({ error: authError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Set admin role
        const { error: roleError } = await supabaseClient
          .from('user_roles')
          .update({ role: 'admin_bkd' })
          .eq('user_id', authData.user.id);

        if (roleError) {
          console.error('Error setting admin role:', roleError);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Admin berhasil dibuat',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        const validation = validateAndSanitize(userData);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sanitizedData = validation.sanitized!;
        const userRole = role || userData.role || 'calon_pppk';
        const email = `${sanitizedData.no_peserta}@pppk.local`;
        const password = generateStrongPassword();

        // Validate admin assignment
        if (userRole === 'admin_bkd') {
          console.log('Creating new admin user');
        }

        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: sanitizedData.full_name,
            nik: sanitizedData.nik,
            no_peserta: sanitizedData.no_peserta,
          },
        });

        if (authError) {
          console.error('Error creating user:', authError);
          return new Response(
            JSON.stringify({ error: authError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Set user role
        const { error: roleError } = await supabaseClient
          .from('user_roles')
          .update({ role: userRole })
          .eq('user_id', authData.user.id);

        if (roleError) {
          console.error('Error setting role:', roleError);
          // Don't fail, just log - trigger will set default role
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            password,
            message: 'User berhasil dibuat. Simpan password ini untuk diberikan kepada user.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID diperlukan' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const validation = validateAndSanitize(userData);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sanitizedData = validation.sanitized!;

        // Prevent admin from lowering their own role
        if (role && role !== 'admin_bkd' && userId === user.id) {
          return new Response(
            JSON.stringify({ error: 'Anda tidak dapat menurunkan role Anda sendiri' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({
            full_name: sanitizedData.full_name,
            nik: sanitizedData.nik,
            no_peserta: sanitizedData.no_peserta,
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Error updating user:', updateError);
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update role if provided
        if (role) {
          const { error: roleError } = await supabaseClient
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId);

          if (roleError) {
            console.error('Error updating role:', roleError);
            return new Response(
              JSON.stringify({ error: roleError.message }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User berhasil diupdate' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID diperlukan' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if this is the last admin
        const { data: adminCount } = await supabaseClient
          .from('user_roles')
          .select('user_id', { count: 'exact' })
          .eq('role', 'admin_bkd');

        const { data: userRole } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .single();

        if (userRole?.role === 'admin_bkd' && adminCount && adminCount.length <= 1) {
          return new Response(
            JSON.stringify({ error: 'Tidak dapat menghapus admin terakhir. Sistem harus memiliki minimal 1 admin.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

        if (deleteError) {
          console.error('Error deleting user:', deleteError);
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User berhasil dihapus' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'bulk_create': {
        const users = userData as UserData[];
        const results = [];

        for (const user of users) {
          const validation = validateAndSanitize(user);
          if (!validation.valid) {
            results.push({ 
              no_peserta: user.no_peserta, 
              success: false, 
              error: validation.error 
            });
            continue;
          }

          const sanitizedData = validation.sanitized!;
          const email = `${sanitizedData.no_peserta}@pppk.local`;
          const password = generateStrongPassword();

          const { error: authError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: sanitizedData.full_name,
              nik: sanitizedData.nik,
              no_peserta: sanitizedData.no_peserta,
            },
          });

          if (authError) {
            results.push({ 
              no_peserta: sanitizedData.no_peserta, 
              success: false, 
              error: authError.message 
            });
          } else {
            results.push({ 
              no_peserta: sanitizedData.no_peserta, 
              success: true, 
              password 
            });
          }
        }

        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        return new Response(
          JSON.stringify({ 
            success: true, 
            results,
            summary: { successCount, errorCount }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in admin-user-management:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

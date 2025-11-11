-- Fix 1: Migrate file_path from full URL to path only
-- Remove domain from existing file_path values in user_dokumen
UPDATE public.user_dokumen 
SET file_path = REGEXP_REPLACE(file_path, '^https://[^/]+/', '')
WHERE file_path LIKE 'https://%';

-- Fix 2: Create missing user_roles entries for profiles without roles
-- Insert default calon_pppk role for all profiles that don't have a role entry yet
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'calon_pppk'::app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
)
ON CONFLICT (user_id, role) DO NOTHING;
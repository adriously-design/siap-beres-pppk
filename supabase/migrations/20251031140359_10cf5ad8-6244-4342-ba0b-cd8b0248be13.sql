-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function that handles existing profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nik TEXT;
  v_no_peserta TEXT;
BEGIN
  -- Get nik and no_peserta from metadata
  v_nik := NEW.raw_user_meta_data->>'nik';
  v_no_peserta := NEW.raw_user_meta_data->>'no_peserta';
  
  -- Check if profile with this NIK already exists (for PPPK users)
  IF v_nik IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE nik = v_nik
  ) THEN
    -- Update existing profile with new auth user ID
    UPDATE public.profiles
    SET 
      id = NEW.id,
      status_aktivasi = true,
      updated_at = now()
    WHERE nik = v_nik;
  ELSE
    -- Insert new profile (for admin or new users)
    INSERT INTO public.profiles (id, full_name, nik, no_peserta)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      v_nik,
      v_no_peserta
    );
  END IF;
  
  -- Assign default role (calon_pppk)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'calon_pppk');
  
  RETURN NEW;
END;
$function$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
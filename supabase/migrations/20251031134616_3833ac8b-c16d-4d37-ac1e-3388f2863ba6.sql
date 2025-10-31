-- Add status_aktivasi column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status_aktivasi BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_status_aktivasi ON public.profiles(status_aktivasi);
CREATE INDEX IF NOT EXISTS idx_profiles_no_peserta ON public.profiles(no_peserta);
CREATE INDEX IF NOT EXISTS idx_profiles_nik ON public.profiles(nik);
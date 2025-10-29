-- Add catatan_user column to user_dokumen table for PPPK notes when uploading
ALTER TABLE public.user_dokumen ADD COLUMN IF NOT EXISTS catatan_user text;
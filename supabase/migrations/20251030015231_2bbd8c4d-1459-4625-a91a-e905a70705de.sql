-- Update document names
UPDATE public.dokumen 
SET nama_dokumen = 'Surat Pernyataan 5 Poin'
WHERE nama_dokumen = 'Surat Lamaran';

UPDATE public.dokumen 
SET nama_dokumen = 'SKCK'
WHERE nama_dokumen = 'Sertifikat Pendidikan';

-- Add columns for message history tracking
ALTER TABLE public.user_dokumen
ADD COLUMN IF NOT EXISTS catatan_history jsonb DEFAULT '[]'::jsonb;

-- Create index for better performance on history queries
CREATE INDEX IF NOT EXISTS idx_user_dokumen_catatan_history ON public.user_dokumen USING gin(catatan_history);
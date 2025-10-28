-- Create storage bucket for dokumen-pppk
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dokumen-pppk',
  'dokumen-pppk',
  false,
  5242880, -- 5MB max
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
);

-- Storage policies for dokumen-pppk bucket
-- Users can upload their own documents
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dokumen-pppk' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokumen-pppk' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dokumen-pppk' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dokumen-pppk' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokumen-pppk' AND
  has_role(auth.uid(), 'admin_bkd'::app_role)
);

-- Insert required documents into dokumen table
INSERT INTO public.dokumen (nama_dokumen, deskripsi, format_file, max_size_kb, is_required)
VALUES 
  ('KTP', 'Kartu Tanda Penduduk yang masih berlaku', ARRAY['jpg', 'jpeg'], 500, true),
  ('Ijazah Terakhir', 'Ijazah pendidikan terakhir yang telah dilegalisir', ARRAY['pdf'], 1024, true),
  ('Transkrip Nilai', 'Transkrip nilai pendidikan terakhir', ARRAY['pdf'], 1024, true),
  ('Surat Lamaran', 'Surat lamaran kerja yang ditujukan kepada BKD', ARRAY['pdf'], 1024, true),
  ('Pas Foto', 'Pas foto terbaru ukuran 4x6 dengan latar belakang merah', ARRAY['jpg', 'jpeg'], 500, true)
ON CONFLICT DO NOTHING;
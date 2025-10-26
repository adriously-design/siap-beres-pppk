-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('calon_pppk', 'admin_bkd');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'calon_pppk',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nik TEXT UNIQUE,
  no_peserta TEXT UNIQUE,
  phone TEXT,
  jabatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create dokumen table
CREATE TABLE public.dokumen (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_dokumen TEXT NOT NULL UNIQUE,
  deskripsi TEXT,
  format_file TEXT[] NOT NULL DEFAULT ARRAY['pdf'],
  max_size_kb INTEGER NOT NULL DEFAULT 2048,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create checklist_item table with conditional rules
CREATE TABLE public.checklist_item (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
  deskripsi_aturan TEXT NOT NULL,
  tipe_validasi TEXT NOT NULL CHECK (tipe_validasi IN ('Format', 'Substansi', 'Mandiri')),
  kondisional_rule JSONB,
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_dokumen table (uploaded documents)
CREATE TABLE public.user_dokumen (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dokumen_id UUID NOT NULL REFERENCES public.dokumen(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_kb INTEGER NOT NULL,
  status_verifikasi TEXT NOT NULL DEFAULT 'pending' CHECK (status_verifikasi IN ('pending', 'verified', 'rejected')),
  catatan_admin TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  UNIQUE(user_id, dokumen_id)
);

-- Create log_verifikasi_pppk table
CREATE TABLE public.log_verifikasi_pppk (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.checklist_item(id) ON DELETE CASCADE,
  user_dokumen_id UUID REFERENCES public.user_dokumen(id) ON DELETE CASCADE,
  status_verifikasi BOOLEAN NOT NULL DEFAULT false,
  catatan_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create e_bimtek table (panduan/FAQ)
CREATE TABLE public.e_bimtek (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  judul TEXT NOT NULL,
  konten TEXT NOT NULL,
  tipe_konten TEXT NOT NULL CHECK (tipe_konten IN ('FAQ', 'Snippet', 'Video_Link', 'E_Book_File')),
  dokumen_terkait UUID REFERENCES public.dokumen(id) ON DELETE SET NULL,
  urutan INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dokumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_verifikasi_pppk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.e_bimtek ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles RLS Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin_bkd'));

-- User Roles RLS Policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin_bkd'));

-- Dokumen RLS Policies (viewable by all authenticated users)
CREATE POLICY "Authenticated users can view dokumen"
  ON public.dokumen FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage dokumen"
  ON public.dokumen FOR ALL
  USING (public.has_role(auth.uid(), 'admin_bkd'));

-- Checklist Item RLS Policies
CREATE POLICY "Authenticated users can view checklist items"
  ON public.checklist_item FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage checklist items"
  ON public.checklist_item FOR ALL
  USING (public.has_role(auth.uid(), 'admin_bkd'));

-- User Dokumen RLS Policies
CREATE POLICY "Users can view their own documents"
  ON public.user_dokumen FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
  ON public.user_dokumen FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.user_dokumen FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user documents"
  ON public.user_dokumen FOR SELECT
  USING (public.has_role(auth.uid(), 'admin_bkd'));

CREATE POLICY "Admins can update user documents"
  ON public.user_dokumen FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin_bkd'));

-- Log Verifikasi RLS Policies
CREATE POLICY "Users can view their own verification logs"
  ON public.log_verifikasi_pppk FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verification logs"
  ON public.log_verifikasi_pppk FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification logs"
  ON public.log_verifikasi_pppk FOR SELECT
  USING (public.has_role(auth.uid(), 'admin_bkd'));

-- E-Bimtek RLS Policies
CREATE POLICY "Authenticated users can view active e-bimtek"
  ON public.e_bimtek FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage e-bimtek"
  ON public.e_bimtek FOR ALL
  USING (public.has_role(auth.uid(), 'admin_bkd'));

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_e_bimtek_updated_at
  BEFORE UPDATE ON public.e_bimtek
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger function to create profile and assign role on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, nik, no_peserta)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'nik',
    NEW.raw_user_meta_data->>'no_peserta'
  );
  
  -- Assign default role (calon_pppk)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'calon_pppk');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample dokumen data
INSERT INTO public.dokumen (nama_dokumen, deskripsi, format_file, max_size_kb, is_required) VALUES
('KTP', 'Kartu Tanda Penduduk yang masih berlaku', ARRAY['pdf', 'jpg', 'jpeg', 'png'], 2048, true),
('Ijazah Terakhir', 'Ijazah pendidikan terakhir yang telah dilegalisir', ARRAY['pdf'], 3072, true),
('Transkrip Nilai', 'Transkrip nilai pendidikan terakhir', ARRAY['pdf'], 2048, true),
('Sertifikat Pendidik', 'Sertifikat Pendidik (khusus untuk Guru)', ARRAY['pdf'], 2048, false),
('Surat Keterangan Sehat', 'Surat keterangan sehat dari dokter', ARRAY['pdf'], 1024, true),
('Pas Foto', 'Pas foto terbaru ukuran 4x6 dengan latar belakang merah', ARRAY['jpg', 'jpeg', 'png'], 512, true);

-- Insert sample checklist items
INSERT INTO public.checklist_item (dokumen_id, deskripsi_aturan, tipe_validasi, kondisional_rule, urutan)
SELECT 
  d.id,
  'Scan dokumen harus berwarna (tidak hitam putih)',
  'Mandiri',
  NULL,
  1
FROM public.dokumen d WHERE d.nama_dokumen = 'KTP';

INSERT INTO public.checklist_item (dokumen_id, deskripsi_aturan, tipe_validasi, kondisional_rule, urutan)
SELECT 
  d.id,
  'Dokumen harus terbaca dengan jelas, tidak blur',
  'Mandiri',
  NULL,
  2
FROM public.dokumen d WHERE d.nama_dokumen = 'KTP';

INSERT INTO public.checklist_item (dokumen_id, deskripsi_aturan, tipe_validasi, kondisional_rule, urutan)
SELECT 
  d.id,
  'Ijazah harus sudah dilegalisir oleh pihak yang berwenang',
  'Substansi',
  NULL,
  1
FROM public.dokumen d WHERE d.nama_dokumen = 'Ijazah Terakhir';

INSERT INTO public.checklist_item (dokumen_id, deskripsi_aturan, tipe_validasi, kondisional_rule, urutan)
SELECT 
  d.id,
  'Wajib upload Sertifikat Pendidik untuk posisi Guru',
  'Substansi',
  '{"condition": "jabatan = Guru"}',
  1
FROM public.dokumen d WHERE d.nama_dokumen = 'Sertifikat Pendidik';

-- Insert sample e-bimtek/FAQ
INSERT INTO public.e_bimtek (judul, konten, tipe_konten, urutan) VALUES
('Cara Upload Dokumen', 'Klik tombol "Upload Dokumen" pada dashboard Anda, pilih jenis dokumen yang akan diupload, pastikan file sesuai format dan ukuran maksimal, kemudian klik "Simpan".', 'Snippet', 1),
('Format File yang Diterima', 'Sistem menerima file dengan format PDF, JPG, JPEG, dan PNG. Pastikan ukuran file tidak melebihi batas maksimal yang ditentukan untuk setiap jenis dokumen.', 'FAQ', 2),
('Apa itu Self-Verification?', 'Self-verification adalah proses dimana Anda sebagai calon PPPK melakukan pengecekan sendiri terhadap kelengkapan dan kesesuaian dokumen sebelum diserahkan ke BKD untuk verifikasi final.', 'FAQ', 3),
('Status Verifikasi Dokumen', 'Pending: Dokumen belum diverifikasi admin. Verified: Dokumen telah diverifikasi dan sesuai. Rejected: Dokumen ditolak, silakan perbaiki sesuai catatan admin.', 'FAQ', 4);
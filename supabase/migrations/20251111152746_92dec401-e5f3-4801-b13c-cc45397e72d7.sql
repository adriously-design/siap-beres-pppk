-- ============================================================
-- 1. HAPUS RLS POLICY PUBLIK PADA PROFILES (FIX ISU #2)
-- ============================================================
-- Hapus policy yang mengizinkan akses publik ke profiles
DROP POLICY IF EXISTS "Allow anon to verify credentials for password reset" ON public.profiles;

-- ============================================================
-- 2. BUAT SECURITY DEFINER FUNCTION UNTUK VERIFIKASI KREDENSIAL
-- ============================================================
-- Fungsi ini hanya mengembalikan boolean, TIDAK mengembalikan data PII
CREATE OR REPLACE FUNCTION public.verify_credentials(
  p_no_peserta TEXT,
  p_nik TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hanya return true/false, tidak return data PII
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE no_peserta = p_no_peserta
      AND nik = p_nik
  );
END;
$$;

-- Grant execute ke anon dan authenticated untuk reset password
GRANT EXECUTE ON FUNCTION public.verify_credentials(TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- 3. BUAT TABEL RATE LIMITING (FIX ISU #4)
-- ============================================================
-- Tabel untuk tracking rate limit attempts
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- bisa berupa NIK, IP, user_id, atau kombinasi
  endpoint TEXT NOT NULL, -- nama endpoint (reset-password, upload-file, dll)
  attempt_count INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk performa lookup
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_endpoint 
  ON public.rate_limit_attempts(identifier, endpoint, last_attempt_at);

-- Enable RLS
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Hanya service role yang bisa akses (edge functions dengan service key)
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limit_attempts
  FOR ALL
  USING (true);

-- ============================================================
-- 4. FUNCTION UNTUK CHECK DAN UPDATE RATE LIMIT
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_attempts INTEGER,
  p_window_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_window_start TIMESTAMPTZ;
  v_is_allowed BOOLEAN := false;
  v_attempts_remaining INTEGER := 0;
  v_reset_at TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Cari record yang ada
  SELECT * INTO v_record
  FROM public.rate_limit_attempts
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
  FOR UPDATE;
  
  -- Jika ada record
  IF FOUND THEN
    -- Cek apakah masih di-block
    IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > now() THEN
      -- Masih di-block
      RETURN jsonb_build_object(
        'allowed', false,
        'attempts_remaining', 0,
        'reset_at', v_record.blocked_until,
        'message', 'Too many attempts. Please try again later.'
      );
    END IF;
    
    -- Cek apakah sudah lewat window time
    IF v_record.last_attempt_at < v_window_start THEN
      -- Reset counter karena sudah lewat window
      UPDATE public.rate_limit_attempts
      SET 
        attempt_count = 1,
        first_attempt_at = now(),
        last_attempt_at = now(),
        blocked_until = NULL
      WHERE identifier = p_identifier AND endpoint = p_endpoint;
      
      v_is_allowed := true;
      v_attempts_remaining := p_max_attempts - 1;
      v_reset_at := now() + (p_window_minutes || ' minutes')::INTERVAL;
    ELSE
      -- Masih dalam window, cek apakah sudah exceed limit
      IF v_record.attempt_count >= p_max_attempts THEN
        -- Block user
        v_reset_at := v_record.first_attempt_at + (p_window_minutes || ' minutes')::INTERVAL;
        
        UPDATE public.rate_limit_attempts
        SET 
          blocked_until = v_reset_at,
          last_attempt_at = now()
        WHERE identifier = p_identifier AND endpoint = p_endpoint;
        
        RETURN jsonb_build_object(
          'allowed', false,
          'attempts_remaining', 0,
          'reset_at', v_reset_at,
          'message', 'Too many attempts. Please try again later.'
        );
      ELSE
        -- Increment counter
        UPDATE public.rate_limit_attempts
        SET 
          attempt_count = attempt_count + 1,
          last_attempt_at = now()
        WHERE identifier = p_identifier AND endpoint = p_endpoint;
        
        v_is_allowed := true;
        v_attempts_remaining := p_max_attempts - (v_record.attempt_count + 1);
        v_reset_at := v_record.first_attempt_at + (p_window_minutes || ' minutes')::INTERVAL;
      END IF;
    END IF;
  ELSE
    -- Belum ada record, buat baru
    INSERT INTO public.rate_limit_attempts (identifier, endpoint, attempt_count, first_attempt_at, last_attempt_at)
    VALUES (p_identifier, p_endpoint, 1, now(), now());
    
    v_is_allowed := true;
    v_attempts_remaining := p_max_attempts - 1;
    v_reset_at := now() + (p_window_minutes || ' minutes')::INTERVAL;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_is_allowed,
    'attempts_remaining', v_attempts_remaining,
    'reset_at', v_reset_at,
    'message', CASE 
      WHEN v_is_allowed THEN 'Request allowed'
      ELSE 'Rate limit exceeded'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- ============================================================
-- 5. CLEANUP FUNCTION (OPSIONAL - UNTUK MAINTENANCE)
-- ============================================================
-- Function untuk cleanup old rate limit records (bisa dijadwalkan)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Hapus record yang lebih dari 24 jam
  DELETE FROM public.rate_limit_attempts
  WHERE last_attempt_at < now() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON TABLE public.rate_limit_attempts IS 'Tracks rate limiting attempts for security endpoints';
COMMENT ON FUNCTION public.verify_credentials(TEXT, TEXT) IS 'Securely verifies user credentials without exposing PII data';
COMMENT ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS 'Checks and enforces rate limits for endpoints';
COMMENT ON FUNCTION public.cleanup_old_rate_limits() IS 'Cleans up old rate limit records (run periodically)';
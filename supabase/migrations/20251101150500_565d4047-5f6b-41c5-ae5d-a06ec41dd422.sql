-- Add RLS policy to allow anonymous users to SELECT from profiles table
-- This is needed for password reset verification functionality
-- Security note: This allows public read access to profiles data including NIK and no_peserta

CREATE POLICY "Allow anon to verify credentials for password reset" 
ON public.profiles 
FOR SELECT 
TO anon
USING (true);

-- Add comment to document the security consideration
COMMENT ON POLICY "Allow anon to verify credentials for password reset" ON public.profiles 
IS 'Allows unauthenticated users to query profiles for password reset verification. Consider implementing rate limiting and monitoring for this endpoint.';
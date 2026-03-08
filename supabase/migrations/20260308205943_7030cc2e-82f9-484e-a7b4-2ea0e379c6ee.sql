
-- Create a secure function to find collaboration by OTP (doesn't expose OTP in response)
CREATE OR REPLACE FUNCTION public.find_collaboration_by_otp(_otp_code text)
RETURNS TABLE(
  id uuid,
  host_user_id uuid,
  title text,
  session_date date,
  is_active boolean,
  otp_expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.host_user_id,
    cs.title,
    cs.session_date,
    cs.is_active,
    cs.otp_expires_at,
    cs.created_at
  FROM public.collaboration_sessions cs
  WHERE cs.otp_code = _otp_code
    AND cs.is_active = true
    AND cs.otp_expires_at > now();
END;
$$;

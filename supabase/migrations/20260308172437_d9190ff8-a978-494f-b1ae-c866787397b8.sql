
-- Fix 1: Remove broad SELECT policy on social_import_config that leaks API keys
DROP POLICY IF EXISTS "Authenticated users can view active social configs" ON public.social_import_config;

-- Create a safe RPC that returns only non-sensitive fields
CREATE OR REPLACE FUNCTION public.get_active_social_platforms()
RETURNS TABLE(platform text, display_name text, is_active boolean, contact_identifier text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.platform, s.display_name, s.is_active, s.contact_identifier
  FROM public.social_import_config s
  WHERE s.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_social_platforms() TO authenticated;

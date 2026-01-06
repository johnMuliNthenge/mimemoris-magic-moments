-- Drop and recreate the view with SECURITY INVOKER (safe default)
DROP VIEW IF EXISTS public.profile_search;

CREATE VIEW public.profile_search 
WITH (security_invoker = true)
AS
SELECT 
  user_id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profile_search TO authenticated;
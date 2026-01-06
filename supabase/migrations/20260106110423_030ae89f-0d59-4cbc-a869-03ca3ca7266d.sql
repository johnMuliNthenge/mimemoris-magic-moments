-- Drop the view since we'll use a secure function instead
DROP VIEW IF EXISTS public.profile_search;

-- Create a secure function to search for users (limited info only - no PII)
-- This is for friend discovery - only exposes name and avatar
CREATE OR REPLACE FUNCTION public.search_users_for_discovery(
  search_term text DEFAULT '',
  page_num integer DEFAULT 0,
  page_size integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.full_name,
    p.avatar_url
  FROM public.profiles p
  WHERE 
    p.user_id != auth.uid()
    AND (search_term = '' OR p.full_name ILIKE '%' || search_term || '%')
  ORDER BY p.full_name ASC
  LIMIT page_size
  OFFSET page_num * page_size
$$;
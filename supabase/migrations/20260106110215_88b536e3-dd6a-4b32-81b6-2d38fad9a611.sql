-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a security definer function to check if users are friends
CREATE OR REPLACE FUNCTION public.is_friend(_user_id uuid, _friend_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_follows
    WHERE status = 'accepted'
      AND (
        (follower_id = _user_id AND following_id = _friend_id)
        OR (follower_id = _friend_id AND following_id = _user_id)
      )
  )
$$;

-- Create restrictive policy: users can only see their own profile or friends' profiles
CREATE POLICY "Users can view own profile or friends profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.is_friend(auth.uid(), user_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Create a view for user search that only exposes non-sensitive info (name, avatar)
-- This is for the friend search functionality
CREATE OR REPLACE VIEW public.profile_search AS
SELECT 
  user_id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profile_search TO authenticated;
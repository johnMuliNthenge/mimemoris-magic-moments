-- Allow all authenticated users to view profiles for search/social features
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop the restrictive old policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
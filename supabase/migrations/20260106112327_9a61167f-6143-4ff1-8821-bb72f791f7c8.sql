-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Members can view group members" ON public.chat_group_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.chat_group_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.chat_group_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.chat_group_members;

-- Create security definer function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Create security definer function to check if user is group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND role = 'admin'
  )
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Members can view group members"
ON public.chat_group_members FOR SELECT
USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Admins can add members"
ON public.chat_group_members FOR INSERT
WITH CHECK (
  is_group_admin(auth.uid(), group_id)
  AND (SELECT COUNT(*) FROM public.chat_group_members WHERE group_id = chat_group_members.group_id) < 
      (SELECT max_members FROM public.chat_groups WHERE id = chat_group_members.group_id)
);

CREATE POLICY "Admins can remove members"
ON public.chat_group_members FOR DELETE
USING (is_group_admin(auth.uid(), group_id));

CREATE POLICY "Admins can update member roles"
ON public.chat_group_members FOR UPDATE
USING (is_group_admin(auth.uid(), group_id));

-- Also fix chat_groups policies that reference chat_group_members
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.chat_groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Group admins can delete groups" ON public.chat_groups;

CREATE POLICY "Users can view groups they are members of"
ON public.chat_groups FOR SELECT
USING (is_group_member(auth.uid(), id));

CREATE POLICY "Group admins can update groups"
ON public.chat_groups FOR UPDATE
USING (is_group_admin(auth.uid(), id));

CREATE POLICY "Group admins can delete groups"
ON public.chat_groups FOR DELETE
USING (is_group_admin(auth.uid(), id));

-- Fix chat_group_messages policies
DROP POLICY IF EXISTS "Members can view group messages" ON public.chat_group_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.chat_group_messages;

CREATE POLICY "Members can view group messages"
ON public.chat_group_messages FOR SELECT
USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Members can send messages"
ON public.chat_group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_group_member(auth.uid(), group_id)
);
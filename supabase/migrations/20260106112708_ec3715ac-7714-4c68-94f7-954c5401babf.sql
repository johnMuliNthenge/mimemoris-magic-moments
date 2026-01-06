-- Fix the SELECT policy for chat_groups to include creators
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.chat_groups;

CREATE POLICY "Users can view groups they are members of or created"
ON public.chat_groups FOR SELECT
USING (
  created_by = auth.uid() 
  OR is_group_member(auth.uid(), id)
);

-- Fix the join policy to allow first member (creator) without recursion issues
DROP POLICY IF EXISTS "Users can join groups via invite" ON public.chat_group_members;

CREATE POLICY "Users can join groups via invite"
ON public.chat_group_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Creator joining their own group (first member)
    EXISTS (SELECT 1 FROM public.chat_groups WHERE id = group_id AND created_by = auth.uid())
    OR
    -- User joining via invite (group exists and not full)
    (SELECT COUNT(*) FROM public.chat_group_members WHERE group_id = chat_group_members.group_id) < 500
  )
);
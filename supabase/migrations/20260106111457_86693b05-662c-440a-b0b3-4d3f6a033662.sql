-- Add reply_to_id, edited_at, and is_deleted columns to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id),
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- Add DELETE policy for chat_messages (users can delete their own sent messages)
CREATE POLICY "Users can delete their own sent messages"
ON public.chat_messages
FOR DELETE
USING (sender_id = auth.uid());

-- Drop and recreate UPDATE policy to include 40 second edit window
DROP POLICY IF EXISTS "Users can update their received messages" ON public.chat_messages;

-- Allow receiver to mark as read (any time)
CREATE POLICY "Users can mark messages as read"
ON public.chat_messages
FOR UPDATE
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());

-- Allow sender to edit their message within 40 seconds
CREATE POLICY "Users can edit their sent messages within 40 seconds"
ON public.chat_messages
FOR UPDATE
USING (
  sender_id = auth.uid() 
  AND created_at > now() - interval '40 seconds'
)
WITH CHECK (sender_id = auth.uid());

-- Create chat_groups table
CREATE TABLE public.chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  created_by uuid NOT NULL,
  invite_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  max_members integer DEFAULT 500,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create chat_group_members table
CREATE TABLE public.chat_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create chat_group_messages table
CREATE TABLE public.chat_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.chat_group_messages(id),
  edited_at timestamp with time zone,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_groups
CREATE POLICY "Users can view groups they are members of"
ON public.chat_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE chat_group_members.group_id = chat_groups.id 
    AND chat_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create groups"
ON public.chat_groups FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups"
ON public.chat_groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE chat_group_members.group_id = chat_groups.id 
    AND chat_group_members.user_id = auth.uid()
    AND chat_group_members.role = 'admin'
  )
);

CREATE POLICY "Group admins can delete groups"
ON public.chat_groups FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE chat_group_members.group_id = chat_groups.id 
    AND chat_group_members.user_id = auth.uid()
    AND chat_group_members.role = 'admin'
  )
);

-- RLS policies for chat_group_members
CREATE POLICY "Members can view group members"
ON public.chat_group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join groups via invite"
ON public.chat_group_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- First member (creator) always allowed
    NOT EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = chat_group_members.group_id)
    OR
    -- Check group is not full
    (SELECT COUNT(*) FROM public.chat_group_members WHERE group_id = chat_group_members.group_id) < 
    (SELECT max_members FROM public.chat_groups WHERE id = chat_group_members.group_id)
  )
);

CREATE POLICY "Admins can add members"
ON public.chat_group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid()
    AND cgm.role = 'admin'
  )
  AND (SELECT COUNT(*) FROM public.chat_group_members WHERE group_id = chat_group_members.group_id) < 
      (SELECT max_members FROM public.chat_groups WHERE id = chat_group_members.group_id)
);

CREATE POLICY "Users can leave groups"
ON public.chat_group_members FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Admins can remove members"
ON public.chat_group_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid()
    AND cgm.role = 'admin'
  )
);

CREATE POLICY "Admins can update member roles"
ON public.chat_group_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid()
    AND cgm.role = 'admin'
  )
);

-- RLS policies for chat_group_messages
CREATE POLICY "Members can view group messages"
ON public.chat_group_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE chat_group_members.group_id = chat_group_messages.group_id 
    AND chat_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send messages"
ON public.chat_group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members 
    WHERE chat_group_members.group_id = chat_group_messages.group_id 
    AND chat_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can edit their messages within 40 seconds"
ON public.chat_group_messages FOR UPDATE
USING (
  sender_id = auth.uid() 
  AND created_at > now() - interval '40 seconds'
)
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON public.chat_group_messages FOR DELETE
USING (sender_id = auth.uid());

-- Create function to get group by invite code (public access for joining)
CREATE OR REPLACE FUNCTION public.get_group_by_invite_code(code text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  avatar_url text,
  member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    g.id,
    g.name,
    g.description,
    g.avatar_url,
    (SELECT COUNT(*) FROM public.chat_group_members WHERE group_id = g.id) as member_count
  FROM public.chat_groups g
  WHERE g.invite_code = code;
$$;

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_messages;
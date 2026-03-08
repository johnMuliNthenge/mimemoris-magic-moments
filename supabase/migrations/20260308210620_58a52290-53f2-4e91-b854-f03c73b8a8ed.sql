
-- Fix 1: Move OTP to separate table only host can read
CREATE TABLE IF NOT EXISTS public.collaboration_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES public.collaboration_sessions(id) ON DELETE CASCADE,
  otp_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collaboration_id)
);

ALTER TABLE public.collaboration_otp ENABLE ROW LEVEL SECURITY;

-- Only hosts can see OTP
CREATE POLICY "Only host can view OTP"
ON public.collaboration_otp
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.collaboration_sessions cs
  WHERE cs.id = collaboration_otp.collaboration_id
    AND cs.host_user_id = auth.uid()
));

-- Fix 2: Fix self-referential group member count bug
DROP POLICY IF EXISTS "Admins can add members" ON public.chat_group_members;
DROP POLICY IF EXISTS "Users can join groups via invite" ON public.chat_group_members;

CREATE POLICY "Admins can add members"
ON public.chat_group_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_group_admin(auth.uid(), group_id)
  AND (SELECT count(*) FROM chat_group_members cgm WHERE cgm.group_id = chat_group_members.group_id)
    < (SELECT max_members FROM chat_groups WHERE chat_groups.id = chat_group_members.group_id)
);

CREATE POLICY "Users can join groups via invite"
ON public.chat_group_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM chat_groups WHERE chat_groups.id = chat_group_members.group_id AND chat_groups.created_by = auth.uid())
    OR (SELECT count(*) FROM chat_group_members cgm WHERE cgm.group_id = chat_group_members.group_id) < 500
  )
);

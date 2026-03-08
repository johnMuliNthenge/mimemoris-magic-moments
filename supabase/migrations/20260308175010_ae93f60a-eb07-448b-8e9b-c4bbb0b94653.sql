
-- Group calls table
CREATE TABLE public.group_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  call_type text NOT NULL DEFAULT 'audio',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_calls ENABLE ROW LEVEL SECURITY;

-- Group call participants table
CREATE TABLE public.group_call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.group_calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  was_kicked boolean DEFAULT false,
  UNIQUE(call_id, user_id)
);

ALTER TABLE public.group_call_participants ENABLE ROW LEVEL SECURITY;

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_call_participants;

-- RLS: Group members can view calls for their groups
CREATE POLICY "Group members can view calls"
ON public.group_calls FOR SELECT TO authenticated
USING (is_group_member(auth.uid(), group_id));

-- RLS: Group members can start calls
CREATE POLICY "Group members can start calls"
ON public.group_calls FOR INSERT TO authenticated
WITH CHECK (auth.uid() = started_by AND is_group_member(auth.uid(), group_id));

-- RLS: Call starter can update (end) calls
CREATE POLICY "Call starter can update calls"
ON public.group_calls FOR UPDATE TO authenticated
USING (auth.uid() = started_by);

-- RLS: Participants can view call participants for calls they can see
CREATE POLICY "Members can view call participants"
ON public.group_call_participants FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.group_calls gc
  WHERE gc.id = call_id AND is_group_member(auth.uid(), gc.group_id)
));

-- RLS: Group members can join calls
CREATE POLICY "Members can join calls"
ON public.group_call_participants FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_calls gc
    WHERE gc.id = call_id AND gc.status = 'active' AND is_group_member(auth.uid(), gc.group_id)
  )
);

-- RLS: Users can update own participation (leave), or call starter can update (kick)
CREATE POLICY "Users or host can update participation"
ON public.group_call_participants FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_calls gc
    WHERE gc.id = call_id AND gc.started_by = auth.uid()
  )
);

-- RLS: Users can delete own participation, or call starter can remove
CREATE POLICY "Users or host can remove participation"
ON public.group_call_participants FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_calls gc
    WHERE gc.id = call_id AND gc.started_by = auth.uid()
  )
);

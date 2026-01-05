-- Create security definer function to check if user is a collaboration participant
CREATE OR REPLACE FUNCTION public.is_collaboration_participant(_user_id uuid, _collaboration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collaboration_participants
    WHERE user_id = _user_id
      AND collaboration_id = _collaboration_id
  )
$$;

-- Create security definer function to check if user is collaboration host
CREATE OR REPLACE FUNCTION public.is_collaboration_host(_user_id uuid, _collaboration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collaboration_sessions
    WHERE id = _collaboration_id
      AND host_user_id = _user_id
  )
$$;

-- Drop old problematic policies
DROP POLICY IF EXISTS "Users can view collaborations they participate in" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Participants can view their collaborations" ON public.collaboration_participants;

-- Create new non-recursive policy for collaboration_sessions
CREATE POLICY "Users can view collaborations they participate in" 
ON public.collaboration_sessions 
FOR SELECT 
USING (
  host_user_id = auth.uid() 
  OR public.is_collaboration_participant(auth.uid(), id)
);

-- Create new non-recursive policy for collaboration_participants
CREATE POLICY "Participants can view their collaborations" 
ON public.collaboration_participants 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR public.is_collaboration_host(auth.uid(), collaboration_id)
);
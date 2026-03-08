
-- Allow host to add themselves as participant (the host creates the session)
DROP POLICY IF EXISTS "Only server can add participants" ON public.collaboration_participants;

CREATE POLICY "Host can add self as participant"
ON public.collaboration_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.collaboration_sessions
    WHERE id = collaboration_participants.collaboration_id
      AND host_user_id = auth.uid()
  )
);

-- Secure function for updating memory usage counter
CREATE OR REPLACE FUNCTION public.increment_memory_usage(_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET memories_used_today = memories_used_today + 1,
      last_memory_date = CURRENT_DATE,
      updated_at = now()
  WHERE id = _subscription_id
    AND user_id = auth.uid();
END;
$$;

-- Secure function for resetting daily count
CREATE OR REPLACE FUNCTION public.reset_daily_memory_count(_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET memories_used_today = 0,
      last_memory_date = CURRENT_DATE,
      updated_at = now()
  WHERE id = _subscription_id
    AND user_id = auth.uid();
END;
$$;

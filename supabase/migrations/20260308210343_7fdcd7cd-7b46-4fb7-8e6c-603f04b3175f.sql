
-- Fix: Hide OTP from participants (only host sees it)
DROP POLICY IF EXISTS "Participants see own collaborations" ON public.collaboration_sessions;

CREATE POLICY "Participants see own collaborations without OTP"
ON public.collaboration_sessions
FOR SELECT
TO authenticated
USING (
  is_collaboration_participant(auth.uid(), id)
  AND host_user_id != auth.uid()
);

-- Fix: Restrict helpdesk config to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can read active helpdesk config" ON public.helpdesk_config;

CREATE POLICY "Authenticated users can read active helpdesk config"
ON public.helpdesk_config
FOR SELECT
TO authenticated
USING (is_active = true);

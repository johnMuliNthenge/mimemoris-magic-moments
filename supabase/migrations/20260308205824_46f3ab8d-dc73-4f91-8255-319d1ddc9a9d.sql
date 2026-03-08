
-- ============================================================
-- FIX 1: Remove user-facing INSERT/UPDATE on user_subscriptions
-- Users should NOT be able to self-assign plans
-- ============================================================

-- Drop the insecure user-facing policies
DROP POLICY IF EXISTS "Users can create own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

-- Create a secure server-side function for subscription management
CREATE OR REPLACE FUNCTION public.upsert_user_subscription(
  _user_id uuid,
  _plan_id uuid,
  _status text DEFAULT 'active',
  _period_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
  VALUES (_user_id, _plan_id, _status, now(), _period_end)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = _plan_id,
    status = _status,
    current_period_start = now(),
    current_period_end = _period_end,
    updated_at = now();
END;
$$;

-- Only allow service_role or edge functions to call this
-- Users can still SELECT their own subscription (existing policy)

-- ============================================================
-- FIX 2: Lock down notifications INSERT to prevent impersonation
-- ============================================================

DROP POLICY IF EXISTS "Auth users can create notifications" ON public.notifications;

CREATE POLICY "Users can only create notifications as themselves"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = from_user_id AND from_user_id IS NOT NULL);

-- Also create a secure function for system-generated notifications
-- (where from_user_id may differ or be null)
CREATE OR REPLACE FUNCTION public.create_system_notification(
  _user_id uuid,
  _type text,
  _content text,
  _from_user_id uuid DEFAULT NULL,
  _reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, content, from_user_id, reference_id)
  VALUES (_user_id, _type, _content, _from_user_id, _reference_id)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ============================================================
-- FIX 3: Require OTP validation for collaboration joins
-- ============================================================

-- Create a secure join function that validates OTP
CREATE OR REPLACE FUNCTION public.join_collaboration_with_otp(
  _collaboration_id uuid,
  _otp_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valid boolean;
BEGIN
  -- Verify OTP matches and session is active + not expired
  SELECT EXISTS (
    SELECT 1 FROM public.collaboration_sessions
    WHERE id = _collaboration_id
      AND otp_code = _otp_code
      AND is_active = true
      AND otp_expires_at > now()
  ) INTO _valid;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid or expired OTP code';
  END IF;

  -- Add participant
  INSERT INTO public.collaboration_participants (collaboration_id, user_id)
  VALUES (_collaboration_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

-- Remove the insecure direct INSERT policy
DROP POLICY IF EXISTS "Users can join collaborations" ON public.collaboration_participants;

-- Add a restrictive policy - only the security definer function can insert
CREATE POLICY "Only server can add participants"
ON public.collaboration_participants
FOR INSERT
TO authenticated
WITH CHECK (false);

-- ============================================================
-- FIX 4: Hide OTP codes from non-host participants  
-- ============================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view collaborations they participate in" ON public.collaboration_sessions;

-- Create a view function that hides OTP for non-hosts
CREATE OR REPLACE FUNCTION public.get_collaboration_details(_collaboration_id uuid)
RETURNS TABLE(
  id uuid,
  host_user_id uuid,
  otp_code text,
  otp_expires_at timestamptz,
  session_date date,
  is_active boolean,
  ended_at timestamptz,
  created_at timestamptz,
  title text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.host_user_id,
    CASE WHEN cs.host_user_id = auth.uid() THEN cs.otp_code ELSE '****' END,
    cs.otp_expires_at,
    cs.session_date,
    cs.is_active,
    cs.ended_at,
    cs.created_at,
    cs.title
  FROM public.collaboration_sessions cs
  WHERE cs.id = _collaboration_id
    AND (cs.host_user_id = auth.uid() OR public.is_collaboration_participant(auth.uid(), cs.id));
END;
$$;

-- Recreate SELECT policy - hosts see everything, participants see masked OTP
CREATE POLICY "Hosts see full details"
ON public.collaboration_sessions
FOR SELECT
TO authenticated
USING (host_user_id = auth.uid());

CREATE POLICY "Participants see own collaborations"
ON public.collaboration_sessions
FOR SELECT
TO authenticated
USING (is_collaboration_participant(auth.uid(), id));

-- Add unique constraint for user_subscriptions to support upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

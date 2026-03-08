
-- 1. Migrate OTP data: update find/join functions to use collaboration_otp table
-- Update find_collaboration_by_otp to use collaboration_otp table
CREATE OR REPLACE FUNCTION public.find_collaboration_by_otp(_otp_code text)
RETURNS TABLE(id uuid, host_user_id uuid, title text, session_date date, is_active boolean, otp_expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.host_user_id,
    cs.title,
    cs.session_date,
    cs.is_active,
    cs.otp_expires_at,
    cs.created_at
  FROM public.collaboration_otp co
  JOIN public.collaboration_sessions cs ON cs.id = co.collaboration_id
  WHERE co.otp_code = _otp_code
    AND cs.is_active = true
    AND cs.otp_expires_at > now();
END;
$$;

-- Update join_collaboration_with_otp to validate against collaboration_otp table
CREATE OR REPLACE FUNCTION public.join_collaboration_with_otp(_collaboration_id uuid, _otp_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _valid boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.collaboration_otp co
    JOIN public.collaboration_sessions cs ON cs.id = co.collaboration_id
    WHERE co.collaboration_id = _collaboration_id
      AND co.otp_code = _otp_code
      AND cs.is_active = true
      AND cs.otp_expires_at > now()
  ) INTO _valid;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid or expired OTP code';
  END IF;

  INSERT INTO public.collaboration_participants (collaboration_id, user_id)
  VALUES (_collaboration_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

-- 2. Create secure RPC for joining groups by invite code (server-side validation)
CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _group_id uuid;
  _member_count bigint;
  _max_members int;
  _already_member boolean;
BEGIN
  -- Find group by invite code
  SELECT id, max_members INTO _group_id, _max_members
  FROM public.chat_groups
  WHERE invite_code = _invite_code;

  IF _group_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid invite code');
  END IF;

  -- Check if already a member
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = _group_id AND user_id = auth.uid()
  ) INTO _already_member;

  IF _already_member THEN
    RETURN jsonb_build_object('error', 'Already a member of this group', 'group_id', _group_id);
  END IF;

  -- Check member count
  SELECT COUNT(*) INTO _member_count
  FROM public.chat_group_members
  WHERE group_id = _group_id;

  IF _member_count >= _max_members THEN
    RETURN jsonb_build_object('error', 'Group is full');
  END IF;

  -- Add member
  INSERT INTO public.chat_group_members (group_id, user_id, role)
  VALUES (_group_id, auth.uid(), 'member');

  RETURN jsonb_build_object('success', true, 'group_id', _group_id);
END;
$$;

-- 3. Drop otp_code column from collaboration_sessions (data now in collaboration_otp)
-- First update get_collaboration_details to not reference otp_code from sessions
CREATE OR REPLACE FUNCTION public.get_collaboration_details(_collaboration_id uuid)
RETURNS TABLE(id uuid, host_user_id uuid, otp_code text, otp_expires_at timestamptz, session_date date, is_active boolean, ended_at timestamptz, created_at timestamptz, title text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.host_user_id,
    CASE WHEN cs.host_user_id = auth.uid() THEN COALESCE(co.otp_code, '****') ELSE '****' END,
    cs.otp_expires_at,
    cs.session_date,
    cs.is_active,
    cs.ended_at,
    cs.created_at,
    cs.title
  FROM public.collaboration_sessions cs
  LEFT JOIN public.collaboration_otp co ON co.collaboration_id = cs.id
  WHERE cs.id = _collaboration_id
    AND (cs.host_user_id = auth.uid() OR public.is_collaboration_participant(auth.uid(), cs.id));
END;
$$;

-- Now drop the otp_code column
ALTER TABLE public.collaboration_sessions DROP COLUMN IF EXISTS otp_code;

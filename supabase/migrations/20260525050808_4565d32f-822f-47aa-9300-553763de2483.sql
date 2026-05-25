
-- 1. Profile discoverability opt-out
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.search_users_for_discovery(search_term text DEFAULT ''::text, page_num integer DEFAULT 0, page_size integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.full_name,
    p.avatar_url
  FROM public.profiles p
  WHERE 
    p.user_id != auth.uid()
    AND p.is_discoverable = true
    AND (search_term = '' OR p.full_name ILIKE '%' || search_term || '%')
  ORDER BY p.full_name ASC
  LIMIT page_size
  OFFSET page_num * page_size
$function$;

-- 2. Social link tokens for Telegram/WhatsApp account linking
CREATE TABLE IF NOT EXISTS public.social_link_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link tokens"
  ON public.social_link_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies: only security-definer functions write.

CREATE OR REPLACE FUNCTION public.create_social_link_token(_platform text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _platform NOT IN ('telegram','whatsapp') THEN
    RAISE EXCEPTION 'Invalid platform';
  END IF;

  -- Invalidate previous unused tokens for this user/platform
  UPDATE public.social_link_tokens
    SET used = true
    WHERE user_id = auth.uid() AND platform = _platform AND used = false;

  _token := encode(extensions.gen_random_bytes(18), 'hex');

  INSERT INTO public.social_link_tokens (token, user_id, platform)
  VALUES (_token, auth.uid(), _platform);

  RETURN _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_social_link_token(_token text, _platform text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
BEGIN
  UPDATE public.social_link_tokens
    SET used = true
    WHERE token = _token
      AND platform = _platform
      AND used = false
      AND expires_at > now()
    RETURNING user_id INTO _user_id;

  RETURN _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_social_link_token(text) TO authenticated;
-- redeem function intentionally not granted to authenticated; only service_role uses it via edge function

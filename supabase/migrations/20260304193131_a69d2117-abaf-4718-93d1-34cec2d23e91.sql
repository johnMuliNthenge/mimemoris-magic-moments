
-- Table for admin-configured social platform API credentials
CREATE TABLE public.social_import_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_active boolean DEFAULT false,
  config jsonb DEFAULT '{}'::jsonb,
  contact_identifier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_import_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage social import config"
  ON public.social_import_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active social configs"
  ON public.social_import_config FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Table mapping which platforms are enabled per subscription plan
CREATE TABLE public.plan_social_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  platform text NOT NULL,
  is_enabled boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, platform)
);

ALTER TABLE public.plan_social_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage plan social platforms"
  ON public.plan_social_platforms FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view plan social platforms"
  ON public.plan_social_platforms FOR SELECT
  TO authenticated
  USING (true);

-- Log table for social imports
CREATE TABLE public.social_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  memory_id uuid REFERENCES public.memories(id) ON DELETE SET NULL,
  source_message_id text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import logs"
  ON public.social_import_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all import logs"
  ON public.social_import_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Seed default platform configurations
INSERT INTO public.social_import_config (platform, display_name, is_active, contact_identifier) VALUES
  ('whatsapp', 'WhatsApp', false, null),
  ('telegram', 'Telegram', false, null),
  ('x', 'X (Twitter)', false, null),
  ('tiktok', 'TikTok', false, null),
  ('facebook', 'Facebook', false, null);

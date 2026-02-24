
-- Create helpdesk config table for admin WhatsApp number
CREATE TABLE public.helpdesk_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.helpdesk_config ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage helpdesk config"
  ON public.helpdesk_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read active config
CREATE POLICY "Authenticated users can read active helpdesk config"
  ON public.helpdesk_config FOR SELECT
  USING (is_active = true);

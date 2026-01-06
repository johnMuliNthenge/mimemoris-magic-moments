-- Add new fields to profiles table for signup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS gender text;

-- Create email_config table for admin SMTP settings
CREATE TABLE IF NOT EXISTS public.email_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_username text NOT NULL,
  smtp_password text NOT NULL,
  sender_email text NOT NULL,
  sender_name text NOT NULL DEFAULT 'Mimemoris',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on email_config
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

-- Only admins can access email config
CREATE POLICY "Admins can manage email config" 
ON public.email_config 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger to update updated_at
CREATE OR REPLACE TRIGGER update_email_config_updated_at
BEFORE UPDATE ON public.email_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- M-Pesa configuration table (admin-managed)
CREATE TABLE public.mpesa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_key text NOT NULL,
  consumer_secret text NOT NULL,
  shortcode text NOT NULL,
  passkey text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  is_active boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mpesa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mpesa config"
ON public.mpesa_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- M-Pesa payment transactions table
CREATE TABLE public.mpesa_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  phone_number text NOT NULL,
  amount numeric NOT NULL,
  checkout_request_id text,
  merchant_request_id text,
  status text NOT NULL DEFAULT 'pending',
  result_code text,
  result_desc text,
  mpesa_receipt_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mpesa transactions"
ON public.mpesa_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create mpesa transactions"
ON public.mpesa_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all mpesa transactions"
ON public.mpesa_transactions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_mpesa_config_updated_at
BEFORE UPDATE ON public.mpesa_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mpesa_transactions_updated_at
BEFORE UPDATE ON public.mpesa_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Create coupon redemptions table for tracking usage history
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id),
  discount_percentage integer NOT NULL,
  original_price numeric NOT NULL,
  discounted_price numeric NOT NULL,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Admins can view all redemptions
CREATE POLICY "Admins can manage redemptions"
ON public.coupon_redemptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view own redemptions
CREATE POLICY "Users can view own redemptions"
ON public.coupon_redemptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Secure RPC to redeem a coupon (validates, records, and increments usage atomically)
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  _coupon_id uuid,
  _plan_id uuid,
  _original_price numeric,
  _payment_method text DEFAULT 'stripe'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _coupon record;
  _discounted_price numeric;
BEGIN
  -- Validate coupon is still valid
  SELECT * INTO _coupon
  FROM public.coupons
  WHERE id = _coupon_id
    AND is_active = true
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE;

  IF _coupon IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon is no longer valid');
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.times_used >= _coupon.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon usage limit reached');
  END IF;

  _discounted_price := ROUND(_original_price * (1 - _coupon.discount_percentage::numeric / 100), 2);

  -- Record redemption
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, plan_id, discount_percentage, original_price, discounted_price, payment_method)
  VALUES (_coupon_id, auth.uid(), _plan_id, _coupon.discount_percentage, _original_price, _discounted_price, _payment_method);

  -- Increment usage
  UPDATE public.coupons
  SET times_used = times_used + 1, updated_at = now()
  WHERE id = _coupon_id;

  RETURN jsonb_build_object('success', true, 'discounted_price', _discounted_price);
END;
$$;

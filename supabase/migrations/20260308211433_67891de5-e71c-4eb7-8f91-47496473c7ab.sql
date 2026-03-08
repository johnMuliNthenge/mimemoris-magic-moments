
-- Create coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percentage integer NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  max_uses integer DEFAULT NULL,
  times_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Admins can manage coupons
CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can view active coupons (for validation)
CREATE POLICY "Auth users can view active coupons"
ON public.coupons FOR SELECT TO authenticated
USING (is_active = true AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE);

-- Secure RPC to validate and apply a coupon
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _coupon record;
BEGIN
  SELECT * INTO _coupon
  FROM public.coupons
  WHERE UPPER(code) = UPPER(_code)
    AND is_active = true
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE;

  IF _coupon IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired coupon code');
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.times_used >= _coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Coupon has reached its usage limit');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_percentage', _coupon.discount_percentage,
    'coupon_id', _coupon.id,
    'code', _coupon.code
  );
END;
$$;

-- RPC to increment coupon usage (called after successful payment)
CREATE OR REPLACE FUNCTION public.use_coupon(_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.coupons
  SET times_used = times_used + 1, updated_at = now()
  WHERE id = _coupon_id
    AND is_active = true;
END;
$$;

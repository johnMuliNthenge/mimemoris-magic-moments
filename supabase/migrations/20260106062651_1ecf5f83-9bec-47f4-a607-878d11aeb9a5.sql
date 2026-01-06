-- Add stripe_price_id column to subscription_plans table
ALTER TABLE public.subscription_plans 
ADD COLUMN stripe_price_id TEXT,
ADD COLUMN stripe_product_id TEXT;

-- Set initial values from the existing hardcoded config
UPDATE public.subscription_plans SET stripe_price_id = 'price_1SmSQKKhPSFOc2Ir29CLhdUP', stripe_product_id = 'prod_TjwInmR333067C' WHERE tier = 'basic';
UPDATE public.subscription_plans SET stripe_price_id = 'price_1SmSQTKhPSFOc2IrZweSkWJI', stripe_product_id = 'prod_TjwJlD5ClW1D0C' WHERE tier = 'standard';
UPDATE public.subscription_plans SET stripe_price_id = 'price_1SmSQdKhPSFOc2IrMTdF6OHk', stripe_product_id = 'prod_TjwJvL09GzBsOL' WHERE tier = 'premium';
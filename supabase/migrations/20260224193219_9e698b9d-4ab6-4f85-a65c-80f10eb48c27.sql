
-- Allow any authenticated user to check if M-Pesa is active (only is_active column)
CREATE POLICY "Authenticated users can check mpesa availability"
ON public.mpesa_config FOR SELECT
TO authenticated
USING (is_active = true);

-- Add INSERT policy for user_subscriptions so users can create their own subscription
CREATE POLICY "Users can create own subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);
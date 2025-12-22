-- Fix infinite recursion in collaboration_sessions RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view collaborations they participate in" ON public.collaboration_sessions;

-- Create a fixed policy without self-reference
CREATE POLICY "Users can view collaborations they participate in"
ON public.collaboration_sessions
FOR SELECT
USING (
  host_user_id = auth.uid() 
  OR id IN (
    SELECT collaboration_id FROM public.collaboration_participants 
    WHERE user_id = auth.uid()
  )
);
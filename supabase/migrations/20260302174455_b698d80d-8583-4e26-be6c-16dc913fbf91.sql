
-- Add locked_until column to memories table
ALTER TABLE public.memories ADD COLUMN locked_until timestamp with time zone DEFAULT NULL;

-- Create future_messages table
CREATE TABLE public.future_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  content text NOT NULL,
  deliver_at timestamp with time zone NOT NULL,
  is_delivered boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.future_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own future messages"
ON public.future_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own delivered messages"
ON public.future_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own future messages"
ON public.future_messages FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own future messages"
ON public.future_messages FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_future_messages_updated_at
BEFORE UPDATE ON public.future_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

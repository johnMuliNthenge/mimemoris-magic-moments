-- Create table for direct-message call history
CREATE TABLE IF NOT EXISTS public.call_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  peer_user_id uuid NOT NULL,
  direction text NOT NULL,
  call_type text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT call_history_direction_check CHECK (direction IN ('incoming', 'outgoing')),
  CONSTRAINT call_history_type_check CHECK (call_type IN ('audio', 'video')),
  CONSTRAINT call_history_status_check CHECK (status IN ('ringing', 'connected', 'completed', 'missed', 'rejected', 'failed', 'canceled')),
  CONSTRAINT call_history_duration_check CHECK (duration_seconds >= 0)
);

ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own call history
CREATE POLICY "Users can view own call history"
ON public.call_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own call history
CREATE POLICY "Users can insert own call history"
ON public.call_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own call history
CREATE POLICY "Users can update own call history"
ON public.call_history
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own call history
CREATE POLICY "Users can delete own call history"
ON public.call_history
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_call_history_user_peer_created_at
ON public.call_history (user_id, peer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_history_user_created_at
ON public.call_history (user_id, created_at DESC);

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS update_call_history_updated_at ON public.call_history;
CREATE TRIGGER update_call_history_updated_at
BEFORE UPDATE ON public.call_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
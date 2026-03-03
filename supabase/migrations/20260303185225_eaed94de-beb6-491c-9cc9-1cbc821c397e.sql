
-- Add metadata columns to memories table
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS sentiment_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emotion_category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS people_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS event_category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privacy_level text DEFAULT 'private';

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_memories_emotion_category ON public.memories(emotion_category);
CREATE INDEX IF NOT EXISTS idx_memories_event_category ON public.memories(event_category);
CREATE INDEX IF NOT EXISTS idx_memories_privacy_level ON public.memories(privacy_level);
CREATE INDEX IF NOT EXISTS idx_memories_people_tags ON public.memories USING GIN(people_tags);
CREATE INDEX IF NOT EXISTS idx_memories_sentiment_score ON public.memories(sentiment_score);

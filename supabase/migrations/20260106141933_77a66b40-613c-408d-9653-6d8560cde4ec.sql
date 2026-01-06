-- Add media_url column to chat_group_messages for image/video sharing
ALTER TABLE public.chat_group_messages 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;
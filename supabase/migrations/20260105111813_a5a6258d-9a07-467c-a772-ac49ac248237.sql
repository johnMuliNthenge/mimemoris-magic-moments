-- Update subscription_plans: rename memory_limit to daily_memory_limit
ALTER TABLE public.subscription_plans 
RENAME COLUMN memory_limit TO daily_memory_limit;

-- Update user_subscriptions: change to track daily usage
ALTER TABLE public.user_subscriptions 
RENAME COLUMN memories_used_this_month TO memories_used_today;

-- Add last_memory_date to track when to reset daily count
ALTER TABLE public.user_subscriptions 
ADD COLUMN last_memory_date date DEFAULT CURRENT_DATE;

-- Create friends/followers table
CREATE TABLE public.user_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS on user_follows
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_follows
CREATE POLICY "Users can view their own follow relationships"
ON public.user_follows FOR SELECT
USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "Users can create follow requests"
ON public.user_follows FOR INSERT
WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can update follow requests they're part of"
ON public.user_follows FOR UPDATE
USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "Users can delete their own follow relationships"
ON public.user_follows FOR DELETE
USING (follower_id = auth.uid() OR following_id = auth.uid());

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_messages
CREATE POLICY "Users can view their own messages"
ON public.chat_messages FOR SELECT
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages to friends"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM public.user_follows 
    WHERE status = 'accepted' AND 
    ((follower_id = auth.uid() AND following_id = receiver_id) OR 
     (following_id = auth.uid() AND follower_id = receiver_id))
  )
);

CREATE POLICY "Users can update their received messages"
ON public.chat_messages FOR UPDATE
USING (receiver_id = auth.uid());

-- Add is_public to memories
ALTER TABLE public.memories 
ADD COLUMN is_public BOOLEAN DEFAULT false;

-- Create memory_comments table
CREATE TABLE public.memory_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on memory_comments
ALTER TABLE public.memory_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for memory_comments
CREATE POLICY "Anyone can view comments on public memories"
ON public.memory_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memories 
    WHERE memories.id = memory_comments.memory_id AND memories.is_public = true
  ) OR
  EXISTS (
    SELECT 1 FROM public.memories 
    WHERE memories.id = memory_comments.memory_id AND memories.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can comment on public memories"
ON public.memory_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.memories 
    WHERE memories.id = memory_comments.memory_id AND memories.is_public = true
  )
);

CREATE POLICY "Users can update their own comments"
ON public.memory_comments FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
ON public.memory_comments FOR DELETE
USING (user_id = auth.uid());

-- Create memory_likes table
CREATE TABLE public.memory_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(memory_id, user_id)
);

-- Enable RLS on memory_likes
ALTER TABLE public.memory_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for memory_likes
CREATE POLICY "Anyone can view likes on public memories"
ON public.memory_likes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memories 
    WHERE memories.id = memory_likes.memory_id AND memories.is_public = true
  ) OR
  EXISTS (
    SELECT 1 FROM public.memories 
    WHERE memories.id = memory_likes.memory_id AND memories.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can like public memories"
ON public.memory_likes FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.memories 
    WHERE memories.id = memory_likes.memory_id AND memories.is_public = true
  )
);

CREATE POLICY "Users can unlike memories"
ON public.memory_likes FOR DELETE
USING (user_id = auth.uid());

-- Add policy for viewing public memories
CREATE POLICY "Anyone can view public memories"
ON public.memories FOR SELECT
USING (is_public = true);

-- Enable realtime for chat and social features
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_likes;

-- Create triggers for updated_at
CREATE TRIGGER update_user_follows_updated_at
BEFORE UPDATE ON public.user_follows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_memory_comments_updated_at
BEFORE UPDATE ON public.memory_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
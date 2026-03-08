
-- Whatup posts table (video-only short posts)
CREATE TABLE public.whatup_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatup_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view whatup posts" ON public.whatup_posts FOR SELECT USING (true);
CREATE POLICY "Users can create own whatup posts" ON public.whatup_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own whatup posts" ON public.whatup_posts FOR DELETE USING (auth.uid() = user_id);

-- Whatup likes
CREATE TABLE public.whatup_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.whatup_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.whatup_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view whatup likes" ON public.whatup_likes FOR SELECT USING (true);
CREATE POLICY "Auth users can like" ON public.whatup_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.whatup_likes FOR DELETE USING (auth.uid() = user_id);

-- Whatup comments
CREATE TABLE public.whatup_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.whatup_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatup_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view whatup comments" ON public.whatup_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can comment" ON public.whatup_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.whatup_comments FOR DELETE USING (auth.uid() = user_id);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_user_id UUID,
  type TEXT NOT NULL,
  reference_id UUID,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Auth users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatup_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatup_comments;

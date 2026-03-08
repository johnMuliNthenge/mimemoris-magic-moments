
ALTER TABLE public.whatup_comments ADD COLUMN reply_to_id UUID REFERENCES public.whatup_comments(id) ON DELETE CASCADE DEFAULT NULL;

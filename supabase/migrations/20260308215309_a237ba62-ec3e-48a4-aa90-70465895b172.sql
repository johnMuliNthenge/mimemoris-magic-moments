
CREATE TABLE public.reported_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  memory_id UUID REFERENCES public.memories(id) ON DELETE CASCADE NOT NULL,
  reason TEXT DEFAULT 'inappropriate',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reporter_id, memory_id)
);

ALTER TABLE public.reported_content ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can report content"
  ON public.reported_content FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Users can see their own reports
CREATE POLICY "Users can view own reports"
  ON public.reported_content FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON public.reported_content FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update reports (review)
CREATE POLICY "Admins can update reports"
  ON public.reported_content FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

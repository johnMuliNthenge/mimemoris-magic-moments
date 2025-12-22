
-- Create storage bucket for memories media
INSERT INTO storage.buckets (id, name, public) VALUES ('memories', 'memories', true);

-- Storage policies for memories bucket
CREATE POLICY "Users can view their own memory files"
ON storage.objects FOR SELECT
USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own memory files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own memory files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own memory files"
ON storage.objects FOR DELETE
USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read for shared collaboration memories
CREATE POLICY "Anyone can view memories bucket files"
ON storage.objects FOR SELECT
USING (bucket_id = 'memories');

-- Fix 1: Make memories bucket private to prevent direct unauthenticated access
UPDATE storage.buckets
SET public = false
WHERE id = 'memories';

-- Fix 2: Remove exposed credential read path from mpesa_config
DROP POLICY IF EXISTS "Authenticated users can check mpesa availability" ON public.mpesa_config;

-- Expose only non-sensitive M-Pesa status through a SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_mpesa_public_status()
RETURNS TABLE(is_active boolean, environment text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.is_active, m.environment
  FROM public.mpesa_config m
  WHERE m.is_active = true
  ORDER BY m.updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_mpesa_public_status() TO authenticated;

-- Fix 3: Tighten storage object read access for memories bucket
DROP POLICY IF EXISTS "Anyone can view memories bucket files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own memory files" ON storage.objects;

CREATE POLICY "Authenticated users can view permitted memory files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'memories'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.memories m
      WHERE (
        m.media_url = storage.objects.name
        OR split_part(m.media_url, '/memories/', 2) = storage.objects.name
        OR m.thumbnail_url = storage.objects.name
        OR split_part(m.thumbnail_url, '/memories/', 2) = storage.objects.name
      )
      AND (
        m.user_id = auth.uid()
        OR m.is_public = true
        OR (
          m.collaboration_id IS NOT NULL
          AND (
            public.is_collaboration_participant(auth.uid(), m.collaboration_id)
            OR public.is_collaboration_host(auth.uid(), m.collaboration_id)
          )
        )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.chat_group_messages gm
      WHERE (
        gm.media_url = storage.objects.name
        OR split_part(gm.media_url, '/memories/', 2) = storage.objects.name
      )
      AND public.is_group_member(auth.uid(), gm.group_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.collaboration_memories cm
      WHERE (
        cm.media_url = storage.objects.name
        OR split_part(cm.media_url, '/memories/', 2) = storage.objects.name
      )
      AND (
        cm.creator_user_id = auth.uid()
        OR public.is_collaboration_participant(auth.uid(), cm.collaboration_id)
        OR public.is_collaboration_host(auth.uid(), cm.collaboration_id)
      )
    )
  )
);
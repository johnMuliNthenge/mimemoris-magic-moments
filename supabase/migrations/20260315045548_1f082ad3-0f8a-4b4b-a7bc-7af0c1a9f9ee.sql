
-- Add missing future_messages policies (some already exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'future_messages' AND policyname = 'Users can view own future messages') THEN
    CREATE POLICY "Users can view own future messages"
      ON public.future_messages FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'future_messages' AND policyname = 'Users can update own future messages') THEN
    CREATE POLICY "Users can update own future messages"
      ON public.future_messages FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'future_messages' AND policyname = 'Users can delete own future messages') THEN
    CREATE POLICY "Users can delete own future messages"
      ON public.future_messages FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

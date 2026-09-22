/*
# Create superadmin-avatars storage bucket with policies

1. Purpose
   Creates a public storage bucket for superadmin profile avatars.
   Previously the Profile screen tried to create the bucket at runtime via
   the client API, which fails because anon/authenticated roles cannot
   create buckets (only the service role can).

2. Security
   - Bucket is public (avatars are displayed in the UI via public URL).
   - INSERT/UPDATE: authenticated users can only write to their own folder
     (storage.foldername(name))[1] = auth.uid()::text
   - SELECT: public read (public bucket)
   - DELETE: authenticated users can only delete their own avatar
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('superadmin-avatars', 'superadmin-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatar_select" ON storage.objects;
CREATE POLICY "avatar_select" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'superadmin-avatars');

DROP POLICY IF EXISTS "avatar_insert_own" ON storage.objects;
CREATE POLICY "avatar_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'superadmin-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_update_own" ON storage.objects;
CREATE POLICY "avatar_update_own" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'superadmin-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'superadmin-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_delete_own" ON storage.objects;
CREATE POLICY "avatar_delete_own" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'superadmin-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

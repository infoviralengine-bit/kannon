DROP POLICY IF EXISTS "Staff can read company logos" ON storage.objects;

CREATE POLICY "Authenticated users can read company logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IS NOT NULL
);
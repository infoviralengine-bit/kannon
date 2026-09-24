CREATE POLICY "Staff can read company logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'team'::public.app_role)
  )
);

CREATE POLICY "Staff can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'team'::public.app_role)
  )
);

CREATE POLICY "Staff can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'team'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'team'::public.app_role)
  )
);

CREATE POLICY "Staff can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'team'::public.app_role)
  )
);
-- Allow outreach users to view their own leads
CREATE POLICY "Outreach can view own leads"
ON public.closer_leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'outreach'::app_role)
  AND created_by = auth.uid()
);

-- Allow admin to delete leads (already exists but let's also allow closer)
CREATE POLICY "Closer can delete leads"
ON public.closer_leads
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'closer'::app_role)
);
DROP POLICY IF EXISTS "Campaign manager can view contracts" ON public.contracts;

DROP POLICY IF EXISTS "Closer admin can manage onboarding_links" ON public.onboarding_links;

CREATE POLICY "Admin can manage onboarding_links"
  ON public.onboarding_links
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Closer can manage own lead onboarding_links"
  ON public.onboarding_links
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'closer'::app_role)
    AND lead_id IN (SELECT id FROM public.closer_leads WHERE created_by = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'closer'::app_role)
    AND lead_id IN (SELECT id FROM public.closer_leads WHERE created_by = auth.uid())
  );
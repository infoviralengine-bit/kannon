DROP POLICY IF EXISTS "Clients can view own campaigns" ON public.campaigns;

CREATE POLICY "Clients can view own campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'client') 
    AND client_profile_id = auth.uid()
  );
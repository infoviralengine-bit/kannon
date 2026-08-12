ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.tiktok_accounts ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- Operator (Account Manager): read + create only, no updates, no deletes
CREATE POLICY "Operator can view creators" ON public.creators
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operator can create creators" ON public.creators
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'operator'::app_role) AND created_by = auth.uid());

CREATE POLICY "Operator can view tiktok_accounts" ON public.tiktok_accounts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operator can create tiktok_accounts" ON public.tiktok_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'operator'::app_role)
    AND created_by = auth.uid()
    AND campaign_id IS NOT NULL
    AND creator_id IS NOT NULL
  );

CREATE POLICY "Operator can view campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operator can view videos" ON public.videos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operator'::app_role));

-- RLS: campaign_manager can SELECT campaigns
CREATE POLICY "Campaign manager can view campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can SELECT creators
CREATE POLICY "Campaign manager can view creators"
  ON public.creators FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can SELECT tiktok_accounts
CREATE POLICY "Campaign manager can view tiktok_accounts"
  ON public.tiktok_accounts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can SELECT videos
CREATE POLICY "Campaign manager can view videos"
  ON public.videos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can SELECT campaign_creators
CREATE POLICY "Campaign manager can view campaign_creators"
  ON public.campaign_creators FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can SELECT contracts
CREATE POLICY "Campaign manager can view contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can SELECT contract_campaigns
CREATE POLICY "Campaign manager can view contract_campaigns"
  ON public.contract_campaigns FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can SELECT contract_creators
CREATE POLICY "Campaign manager can view contract_creators"
  ON public.contract_creators FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role));

-- RLS: campaign_manager can view own profile
CREATE POLICY "Campaign manager can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'campaign_manager'::app_role) AND id = auth.uid());

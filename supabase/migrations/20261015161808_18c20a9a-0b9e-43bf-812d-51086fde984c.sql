DROP POLICY IF EXISTS allocation_campaigns_read ON public.allocation_campaigns;
CREATE POLICY allocation_campaigns_read ON public.allocation_campaigns FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role) OR has_role(auth.uid(),'campaign_manager'::app_role) OR has_role(auth.uid(),'operator'::app_role));
DROP POLICY IF EXISTS allocation_creators_read ON public.allocation_creators;
CREATE POLICY allocation_creators_read ON public.allocation_creators FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role) OR has_role(auth.uid(),'campaign_manager'::app_role) OR has_role(auth.uid(),'operator'::app_role));
DROP POLICY IF EXISTS allocation_groups_read ON public.allocation_groups;
CREATE POLICY allocation_groups_read ON public.allocation_groups FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role) OR has_role(auth.uid(),'campaign_manager'::app_role) OR has_role(auth.uid(),'operator'::app_role));
DROP POLICY IF EXISTS allocation_slots_read ON public.allocation_slots;
CREATE POLICY allocation_slots_read ON public.allocation_slots FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role) OR has_role(auth.uid(),'campaign_manager'::app_role) OR has_role(auth.uid(),'operator'::app_role));
DROP POLICY IF EXISTS allocation_weeks_read ON public.allocation_weeks;
CREATE POLICY allocation_weeks_read ON public.allocation_weeks FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role) OR has_role(auth.uid(),'campaign_manager'::app_role) OR has_role(auth.uid(),'operator'::app_role));

CREATE OR REPLACE FUNCTION public.get_allocation_contract_links()
RETURNS TABLE(creator_id uuid, contract_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role) OR has_role(auth.uid(),'campaign_manager'::app_role) OR has_role(auth.uid(),'operator'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY SELECT cc.creator_id, c.name FROM contract_creators cc JOIN contracts c ON c.id = cc.contract_id;
END $$;
REVOKE ALL ON FUNCTION public.get_allocation_contract_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_allocation_contract_links() TO authenticated;
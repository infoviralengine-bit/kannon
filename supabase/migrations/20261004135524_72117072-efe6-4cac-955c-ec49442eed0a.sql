DROP POLICY IF EXISTS "Campaign managers see active campaign company identity" ON public.companies;
CREATE OR REPLACE FUNCTION public.get_allocation_company_logos() RETURNS TABLE(company_id uuid, logo_url text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'campaign_manager'::app_role)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT DISTINCT co.id, co.logo_url FROM public.companies co JOIN public.campaigns c ON c.company_id = co.id JOIN public.allocation_campaigns ac ON ac.campaign_id = c.id WHERE c.status = 'active';
END $$;
REVOKE ALL ON FUNCTION public.get_allocation_company_logos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_allocation_company_logos() TO authenticated, service_role;
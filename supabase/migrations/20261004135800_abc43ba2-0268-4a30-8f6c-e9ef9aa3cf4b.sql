CREATE OR REPLACE FUNCTION public.fill_allocation_campaign_logo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
  SELECT co.logo_url INTO NEW.logo_url FROM public.campaigns c LEFT JOIN public.companies co ON co.id = c.company_id WHERE c.id = NEW.campaign_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fill_allocation_campaign_logo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER fill_allocation_campaign_logo_before_insert BEFORE INSERT OR UPDATE OF campaign_id ON public.allocation_campaigns FOR EACH ROW EXECUTE FUNCTION public.fill_allocation_campaign_logo();
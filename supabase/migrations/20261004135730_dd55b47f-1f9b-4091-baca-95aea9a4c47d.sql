ALTER TABLE public.allocation_campaigns ADD COLUMN IF NOT EXISTS logo_url text;
UPDATE public.allocation_campaigns ac SET logo_url = co.logo_url FROM public.campaigns c JOIN public.companies co ON co.id = c.company_id WHERE ac.campaign_id = c.id AND ac.logo_url IS DISTINCT FROM co.logo_url;
CREATE OR REPLACE FUNCTION public.sync_allocation_campaign_logo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    UPDATE public.allocation_campaigns ac SET logo_url = NEW.logo_url FROM public.campaigns c WHERE ac.campaign_id = c.id AND c.company_id = NEW.id AND ac.logo_url IS DISTINCT FROM NEW.logo_url;
  ELSE
    UPDATE public.allocation_campaigns ac SET logo_url = (SELECT co.logo_url FROM public.companies co WHERE co.id = NEW.company_id) WHERE ac.campaign_id = NEW.id AND ac.logo_url IS DISTINCT FROM (SELECT co.logo_url FROM public.companies co WHERE co.id = NEW.company_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_allocation_campaign_logo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_allocation_logo_on_company AFTER UPDATE OF logo_url ON public.companies FOR EACH ROW EXECUTE FUNCTION public.sync_allocation_campaign_logo();
CREATE TRIGGER sync_allocation_logo_on_campaign AFTER UPDATE OF company_id ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.sync_allocation_campaign_logo();
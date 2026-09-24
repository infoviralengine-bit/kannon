
CREATE OR REPLACE FUNCTION public.sync_campaign_client_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_legal text;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT legal_name INTO v_legal FROM public.companies WHERE id = NEW.company_id;
    IF v_legal IS NOT NULL AND v_legal <> '' THEN NEW.client_name := v_legal; END IF;
  END IF;
  NEW.client_name := coalesce(NEW.client_name, '');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.propagate_company_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.legal_name IS DISTINCT FROM OLD.legal_name THEN
    UPDATE public.campaigns SET client_name = coalesce(NEW.legal_name, '')
    WHERE company_id = NEW.id AND client_name IS DISTINCT FROM coalesce(NEW.legal_name, '');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS propagate_company_name ON public.companies;
DROP TRIGGER IF EXISTS trg_propagate_company_name ON public.companies;
CREATE TRIGGER trg_propagate_company_name AFTER UPDATE OF legal_name ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.propagate_company_name();

CREATE OR REPLACE FUNCTION public.propagate_campaign_referent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND NEW.client_name IS DISTINCT FROM OLD.client_name THEN
    UPDATE public.companies SET legal_name = nullif(NEW.client_name, '')
    WHERE id = NEW.company_id AND legal_name IS DISTINCT FROM nullif(NEW.client_name, '');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_propagate_campaign_referent ON public.campaigns;
CREATE TRIGGER trg_propagate_campaign_referent AFTER UPDATE OF client_name ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.propagate_campaign_referent();

-- Backfill: copy referents into companies and link campaigns by matching name
UPDATE public.companies co SET legal_name = c.client_name
FROM public.campaigns c
WHERE lower(c.name) = lower(co.name) AND c.client_name <> co.name AND co.legal_name IS NULL;

UPDATE public.campaigns c SET company_id = co.id
FROM public.companies co
WHERE c.company_id IS NULL AND lower(c.name) = lower(co.name);

UPDATE public.campaigns c SET client_name = ''
FROM public.companies co
WHERE c.company_id = co.id AND c.client_name = co.name AND co.legal_name IS NULL;

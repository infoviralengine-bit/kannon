CREATE OR REPLACE FUNCTION public.auto_allocation_ve_slots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM contracts WHERE id = NEW.contract_id AND btrim(name) ~* '^ve$') THEN
    INSERT INTO allocation_creators (creator_id, daily_slots) VALUES (NEW.creator_id, 6)
    ON CONFLICT (creator_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contract_creators_ve_allocation ON public.contract_creators;
CREATE TRIGGER contract_creators_ve_allocation AFTER INSERT ON public.contract_creators
FOR EACH ROW EXECUTE FUNCTION public.auto_allocation_ve_slots();

INSERT INTO public.allocation_creators (creator_id, daily_slots)
SELECT DISTINCT cc.creator_id, 6 FROM public.contract_creators cc
JOIN public.contracts k ON k.id = cc.contract_id
WHERE btrim(k.name) ~* '^ve$'
ON CONFLICT (creator_id) DO NOTHING;
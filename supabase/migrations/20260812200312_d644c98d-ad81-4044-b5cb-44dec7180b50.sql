ALTER TABLE public.onboarding_links
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.onboarding_links ol
SET first_name = cl.first_name,
    last_name = cl.last_name,
    phone = cl.phone
FROM public.closer_leads cl
WHERE cl.id = ol.lead_id AND ol.first_name IS NULL;

ALTER TABLE public.onboarding_links DROP CONSTRAINT IF EXISTS onboarding_links_lead_id_fkey;
ALTER TABLE public.onboarding_links ALTER COLUMN lead_id DROP NOT NULL;
DROP POLICY IF EXISTS "Closer can manage own lead onboarding_links" ON public.onboarding_links;
ALTER TABLE public.onboarding_links DROP COLUMN IF EXISTS lead_id;

CREATE OR REPLACE FUNCTION public.get_onboarding_data(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_link record;
  v_contracts jsonb;
  v_contract_campaigns jsonb;
BEGIN
  v_token := lower(regexp_replace(coalesce(p_token, ''), '[^a-f0-9]', '', 'g'));
  IF length(v_token) <> 64 THEN
    RETURN NULL;
  END IF;

  SELECT id, token, contract_ids, status, first_name, last_name
    INTO v_link
  FROM onboarding_links
  WHERE token = v_token;

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'contract_text', c.contract_text,
    'creator_cpm', c.creator_cpm,
    'creator_fixed', c.creator_fixed,
    'min_videos_per_day', c.min_videos_per_day
  )), '[]'::jsonb)
    INTO v_contracts
  FROM contracts c
  WHERE c.id = ANY(v_link.contract_ids);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'contract_id', cc.contract_id,
    'campaign_id', cc.campaign_id,
    'campaign_name', cmp.name
  )), '[]'::jsonb)
    INTO v_contract_campaigns
  FROM contract_campaigns cc
  JOIN campaigns cmp ON cmp.id = cc.campaign_id
  WHERE cc.contract_id = ANY(v_link.contract_ids);

  RETURN jsonb_build_object(
    'link', jsonb_build_object(
      'id', v_link.id,
      'token', v_link.token,
      'contract_ids', v_link.contract_ids,
      'status', v_link.status
    ),
    'lead', jsonb_build_object(
      'first_name', v_link.first_name,
      'last_name', v_link.last_name
    ),
    'contracts', v_contracts,
    'contract_campaigns', v_contract_campaigns
  );
END;
$function$;

DROP TABLE IF EXISTS public.closer_leads CASCADE;
DROP TABLE IF EXISTS public.outreach_stats CASCADE;
DROP TABLE IF EXISTS public.outreach_templates CASCADE;
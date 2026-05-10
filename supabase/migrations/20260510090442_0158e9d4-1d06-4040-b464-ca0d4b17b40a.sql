
-- Drop overly-permissive anon SELECT policies
DROP POLICY IF EXISTS "Public can view onboarding by token" ON public.onboarding_links;
DROP POLICY IF EXISTS "Anon can read leads for onboarding join" ON public.closer_leads;
DROP POLICY IF EXISTS "Anon can read contracts for onboarding" ON public.contracts;
DROP POLICY IF EXISTS "Anon can read campaigns for onboarding" ON public.campaigns;
DROP POLICY IF EXISTS "Anon can read contract_campaigns for onboarding" ON public.contract_campaigns;

-- Create a SECURITY DEFINER RPC that returns the minimum data needed for the
-- public onboarding flow, scoped to a specific (long, random) token.
CREATE OR REPLACE FUNCTION public.get_onboarding_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_link record;
  v_lead record;
  v_contracts jsonb;
  v_contract_campaigns jsonb;
BEGIN
  -- Normalize: only allow 64-char lowercase hex tokens
  v_token := lower(regexp_replace(coalesce(p_token, ''), '[^a-f0-9]', '', 'g'));
  IF length(v_token) <> 64 THEN
    RETURN NULL;
  END IF;

  SELECT id, token, lead_id, contract_ids, status
    INTO v_link
  FROM onboarding_links
  WHERE token = v_token;

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT first_name, last_name
    INTO v_lead
  FROM closer_leads
  WHERE id = v_link.lead_id;

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
      'lead_id', v_link.lead_id,
      'contract_ids', v_link.contract_ids,
      'status', v_link.status
    ),
    'lead', CASE WHEN v_lead IS NULL THEN NULL ELSE jsonb_build_object(
      'first_name', v_lead.first_name,
      'last_name', v_lead.last_name
    ) END,
    'contracts', v_contracts,
    'contract_campaigns', v_contract_campaigns
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_onboarding_data(text) TO anon, authenticated;

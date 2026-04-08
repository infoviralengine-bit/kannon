
CREATE OR REPLACE FUNCTION public.get_creator_contract_campaigns(_user_id uuid)
RETURNS TABLE(contract_id uuid, campaign_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.contract_id, cc.campaign_id
  FROM contract_campaigns cc
  WHERE cc.contract_id IN (
    SELECT cr.contract_id 
    FROM contract_creators cr
    WHERE cr.creator_id IN (
      SELECT c.id FROM creators c WHERE c.profile_id = _user_id
    )
  );
$$;

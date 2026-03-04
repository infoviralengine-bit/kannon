
CREATE OR REPLACE FUNCTION public.get_campaign_total_views(p_campaign_ids uuid[])
RETURNS TABLE (
  campaign_id uuid,
  total_views bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    ta.campaign_id,
    COALESCE(SUM(
      CASE
        WHEN v.window_closed AND v.views_final IS NOT NULL THEN v.views_final
        ELSE COALESCE(v.views, 0)
      END
    ), 0)::bigint AS total_views
  FROM tiktok_accounts ta
  JOIN videos v ON v.tiktok_account_id = ta.id
  WHERE ta.campaign_id = ANY(p_campaign_ids)
  GROUP BY ta.campaign_id;
$$;

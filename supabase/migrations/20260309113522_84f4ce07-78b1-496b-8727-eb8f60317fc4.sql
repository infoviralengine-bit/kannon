
CREATE OR REPLACE FUNCTION public.get_client_daily_views(p_user_id uuid, p_days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_result json;
BEGIN
  -- Find the campaign linked to this client
  SELECT id INTO v_campaign_id
  FROM campaigns
  WHERE client_profile_id = p_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_agg(row_to_json(t) ORDER BY t.day)
  INTO v_result
  FROM (
    SELECT
      d.day::date AS day,
      COALESCE(SUM(v.views), 0) AS views,
      COUNT(v.id) AS videos_published
    FROM generate_series(
      CURRENT_DATE - (p_days || ' days')::interval,
      CURRENT_DATE,
      '1 day'::interval
    ) AS d(day)
    LEFT JOIN tiktok_accounts ta ON ta.campaign_id = v_campaign_id AND ta.is_active = true
    LEFT JOIN videos v ON v.tiktok_account_id = ta.id
      AND v.published_at::date = d.day::date
    GROUP BY d.day
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

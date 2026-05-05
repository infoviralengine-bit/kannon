CREATE OR REPLACE FUNCTION public.get_client_top_videos(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_camp_id uuid;
  v_top_views jsonb;
  v_top_comments jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;
  IF NOT has_role(p_user_id, 'client') THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_camp_id FROM campaigns WHERE client_profile_id = p_user_id LIMIT 1;
  IF v_camp_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.effective_views DESC), '[]'::jsonb)
  INTO v_top_views
  FROM (
    SELECT
      v.id, v.tiktok_video_id, v.published_at, v.likes,
      COALESCE(v.comments, 0) AS comments, ta.username,
      CASE WHEN v.window_closed AND v.views_final IS NOT NULL THEN v.views_final ELSE COALESCE(v.views, 0) END AS effective_views
    FROM videos v
    JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id
    WHERE ta.campaign_id = v_camp_id
    ORDER BY effective_views DESC
    LIMIT p_limit
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.comments DESC), '[]'::jsonb)
  INTO v_top_comments
  FROM (
    SELECT
      v.id, v.tiktok_video_id, v.published_at, v.likes,
      COALESCE(v.comments, 0) AS comments, ta.username,
      CASE WHEN v.window_closed AND v.views_final IS NOT NULL THEN v.views_final ELSE COALESCE(v.views, 0) END AS effective_views
    FROM videos v
    JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id
    WHERE ta.campaign_id = v_camp_id AND COALESCE(v.comments, 0) > 0
    ORDER BY v.comments DESC NULLS LAST
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object('top_views', v_top_views, 'top_comments', v_top_comments);
END;
$$;
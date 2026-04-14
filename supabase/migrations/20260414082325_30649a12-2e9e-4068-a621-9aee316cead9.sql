
ALTER TABLE campaigns
  ADD COLUMN min_monthly_videos integer DEFAULT 0;

ALTER TABLE campaigns
  RENAME COLUMN client_fixed_per_creator TO client_fixed;

ALTER TABLE campaigns
  DROP COLUMN planned_creators;

-- Update the get_client_campaign_data function to use new column names
CREATE OR REPLACE FUNCTION public.get_client_campaign_data(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_camp record;
  v_result jsonb;
  v_accounts jsonb;
  v_now timestamptz := now();
  v_1d timestamptz := v_now - interval '1 day';
  v_7d timestamptz := v_now - interval '7 days';
  v_30d timestamptz := v_now - interval '30 days';
  v_90d timestamptz := v_now - interval '90 days';
  v_today_start timestamptz := date_trunc('day', v_now);
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;

  IF NOT has_role(p_user_id, 'client') THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_camp FROM campaigns WHERE client_profile_id = p_user_id LIMIT 1;
  IF v_camp IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(acc_stats)::jsonb ORDER BY acc_stats.username), '[]'::jsonb)
  INTO v_accounts
  FROM (
    SELECT
      ta.username,
      COALESCE(SUM(v.views), 0)::int AS total_views,
      COUNT(v.id)::int AS total_videos,
      COUNT(v.id) FILTER (WHERE v.published_at >= v_today_start)::int AS videos_today,
      COALESCE(SUM(v.views) FILTER (WHERE v.published_at >= v_7d), 0)::int AS views_7d,
      COALESCE(SUM(v.views) FILTER (WHERE v.published_at >= v_30d), 0)::int AS views_30d
    FROM tiktok_accounts ta
    LEFT JOIN videos v ON v.tiktok_account_id = ta.id
    WHERE ta.campaign_id = v_camp.id
    GROUP BY ta.id, ta.username
  ) acc_stats;

  SELECT jsonb_build_object(
    'campaign', jsonb_build_object(
      'id', v_camp.id, 'name', v_camp.name, 'client_name', v_camp.client_name,
      'status', v_camp.status, 'start_date', v_camp.start_date, 'end_date', v_camp.end_date,
      'client_cpm', v_camp.client_cpm,
      'client_fixed', v_camp.client_fixed,
      'min_monthly_videos', v_camp.min_monthly_videos,
      'video_views_cap', v_camp.video_views_cap
    ),
    'accounts', v_accounts,
    'active_creators', (SELECT count(DISTINCT c.id) FROM campaign_creators cc JOIN creators c ON c.id = cc.creator_id WHERE cc.campaign_id = v_camp.id AND c.status = 'active'),
    'total_creators', (SELECT count(*) FROM campaign_creators WHERE campaign_id = v_camp.id),
    'views_1d', COALESCE((SELECT sum(v.views) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_1d), 0),
    'views_7d', COALESCE((SELECT sum(v.views) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_7d), 0),
    'views_30d', COALESCE((SELECT sum(v.views) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_30d), 0),
    'views_90d', COALESCE((SELECT sum(v.views) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_90d), 0),
    'likes_1d', COALESCE((SELECT sum(v.likes) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_1d), 0),
    'likes_7d', COALESCE((SELECT sum(v.likes) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_7d), 0),
    'likes_30d', COALESCE((SELECT sum(v.likes) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_30d), 0),
    'likes_90d', COALESCE((SELECT sum(v.likes) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_90d), 0),
    'comments_1d', COALESCE((SELECT sum(v.comments) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_1d), 0),
    'comments_7d', COALESCE((SELECT sum(v.comments) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_7d), 0),
    'comments_30d', COALESCE((SELECT sum(v.comments) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_30d), 0),
    'comments_90d', COALESCE((SELECT sum(v.comments) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_90d), 0),
    'videos_today', (SELECT count(*) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_today_start),
    'avg_videos_per_day_30d', (SELECT COALESCE(round(count(*)::numeric / GREATEST(1, 30), 1), 0) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_30d),
    'total_videos', (SELECT count(*) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

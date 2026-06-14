
CREATE OR REPLACE VIEW public.v_video_performance
WITH (security_invoker = true) AS
SELECT
  v.id,
  v.tiktok_video_id,
  v.tiktok_account_id,
  v.published_at,
  v.window_expires_at,
  v.window_closed,
  v.views,
  v.views_final,
  v.likes,
  v.comments,
  v.last_scraped_at,
  ta.username AS account_username,
  ta.account_type,
  ta.is_active AS account_active,
  ta.creator_id,
  cr.name AS creator_name,
  cr.creator_cpm,
  cr.creator_fixed,
  cr.status AS creator_status,
  ta.campaign_id,
  c.name AS campaign_name,
  c.client_name,
  c.client_cpm,
  c.video_views_cap,
  c.start_date AS campaign_start_date,
  CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0)
       ELSE COALESCE(v.views, 0) END AS raw_effective_views,
  CASE
    WHEN c.video_views_cap IS NOT NULL AND c.video_views_cap > 0 THEN
      LEAST(
        CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END,
        c.video_views_cap
      )
    ELSE
      CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END
  END AS effective_views,
  COALESCE(v.likes, 0) + COALESCE(v.comments, 0) AS total_engagements,
  CASE WHEN COALESCE(v.views, 0) > 0
       THEN ROUND((COALESCE(v.likes,0) + COALESCE(v.comments,0))::numeric / v.views::numeric * 100, 2)
       ELSE 0 END AS engagement_pct,
  CASE
    WHEN v.window_closed THEN 'closed'
    WHEN v.window_expires_at IS NULL THEN 'open'
    WHEN v.window_expires_at <= now() THEN 'closed'
    WHEN v.window_expires_at <= now() + interval '24 hours' THEN 'closing'
    ELSE 'open'
  END AS window_status,
  EXTRACT(EPOCH FROM (now() - v.published_at)) / 86400.0 AS age_days,
  ('https://www.tiktok.com/@' || ta.username || '/video/' || v.tiktok_video_id) AS tiktok_url
FROM public.videos v
JOIN public.tiktok_accounts ta ON ta.id = v.tiktok_account_id
LEFT JOIN public.creators cr   ON cr.id = ta.creator_id
LEFT JOIN public.campaigns c   ON c.id  = ta.campaign_id;

GRANT SELECT ON public.v_video_performance TO authenticated;

CREATE OR REPLACE FUNCTION public.get_video_analytics(
  p_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_to   date DEFAULT CURRENT_DATE,
  p_campaign_ids uuid[] DEFAULT NULL,
  p_creator_ids  uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH base AS (
    SELECT * FROM public.v_video_performance
    WHERE published_at::date BETWEEN p_from AND p_to
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
      AND (p_creator_ids  IS NULL OR creator_id  = ANY(p_creator_ids))
  ),
  kpi AS (
    SELECT
      COUNT(*) AS total_videos,
      COALESCE(SUM(effective_views), 0)::bigint AS total_views,
      COALESCE(SUM(views), 0)::bigint AS total_raw_views,
      COALESCE(SUM(likes), 0)::bigint AS total_likes,
      COALESCE(SUM(comments), 0)::bigint AS total_comments,
      CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(effective_views))::bigint ELSE 0 END AS avg_views_per_video,
      CASE WHEN SUM(views) > 0
        THEN ROUND((SUM(likes) + SUM(comments))::numeric / SUM(views)::numeric * 100, 2)
        ELSE 0 END AS avg_engagement_pct
    FROM base
  ),
  window_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE window_status = 'open')    AS open_count,
      COUNT(*) FILTER (WHERE window_status = 'closing') AS closing_count,
      COUNT(*) FILTER (WHERE window_status = 'closed')  AS closed_count
    FROM base
  ),
  by_campaign AS (
    SELECT
      campaign_id,
      MAX(campaign_name) AS campaign_name,
      MAX(client_name) AS client_name,
      COUNT(*)::int AS video_count,
      COALESCE(SUM(effective_views), 0)::bigint AS total_views,
      COALESCE(SUM(likes + comments), 0)::bigint AS total_engagements,
      CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(effective_views))::bigint ELSE 0 END AS avg_views_per_video
    FROM base WHERE campaign_id IS NOT NULL
    GROUP BY campaign_id ORDER BY total_views DESC LIMIT 20
  ),
  by_creator AS (
    SELECT
      creator_id,
      MAX(creator_name) AS creator_name,
      COUNT(*)::int AS video_count,
      COALESCE(SUM(effective_views), 0)::bigint AS total_views,
      COALESCE(SUM(likes + comments), 0)::bigint AS total_engagements,
      CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(effective_views))::bigint ELSE 0 END AS avg_views_per_video
    FROM base WHERE creator_id IS NOT NULL
    GROUP BY creator_id ORDER BY total_views DESC LIMIT 20
  ),
  by_day AS (
    SELECT
      published_at::date AS day,
      COUNT(*)::int AS video_count,
      COALESCE(SUM(effective_views), 0)::bigint AS total_views,
      COALESCE(SUM(likes + comments), 0)::bigint AS total_engagements
    FROM base GROUP BY 1 ORDER BY 1
  ),
  top_video AS (
    SELECT id, tiktok_video_id, account_username, creator_name, campaign_name,
           effective_views, likes, comments, published_at, tiktok_url, window_status
    FROM base ORDER BY effective_views DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'kpi', (SELECT row_to_json(k.*) FROM kpi k),
    'window_stats', (SELECT row_to_json(w.*) FROM window_stats w),
    'by_campaign', COALESCE((SELECT jsonb_agg(row_to_json(bc.*)) FROM by_campaign bc), '[]'::jsonb),
    'by_creator',  COALESCE((SELECT jsonb_agg(row_to_json(bcr.*)) FROM by_creator bcr), '[]'::jsonb),
    'by_day',      COALESCE((SELECT jsonb_agg(row_to_json(bd.*)) FROM by_day bd), '[]'::jsonb),
    'top_video',   (SELECT row_to_json(tv.*) FROM top_video tv)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_video_analytics(date, date, uuid[], uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_top_videos(
  p_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_to   date DEFAULT CURRENT_DATE,
  p_campaign_ids uuid[] DEFAULT NULL,
  p_creator_ids  uuid[] DEFAULT NULL,
  p_sort_by      text   DEFAULT 'views',
  p_sort_dir     text   DEFAULT 'desc',
  p_limit        int    DEFAULT 50,
  p_offset       int    DEFAULT 0
)
RETURNS TABLE(
  id uuid, tiktok_video_id text, account_username text,
  creator_id uuid, creator_name text,
  campaign_id uuid, campaign_name text, client_name text,
  published_at timestamptz,
  effective_views bigint, raw_views integer,
  likes integer, comments integer, engagement_pct numeric,
  window_status text, tiktok_url text, total_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_total bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.v_video_performance vp
  WHERE vp.published_at::date BETWEEN p_from AND p_to
    AND (p_campaign_ids IS NULL OR vp.campaign_id = ANY(p_campaign_ids))
    AND (p_creator_ids  IS NULL OR vp.creator_id  = ANY(p_creator_ids));

  RETURN QUERY
  SELECT vp.id, vp.tiktok_video_id, vp.account_username,
    vp.creator_id, vp.creator_name,
    vp.campaign_id, vp.campaign_name, vp.client_name,
    vp.published_at, vp.effective_views::bigint,
    vp.views AS raw_views, vp.likes, vp.comments,
    vp.engagement_pct, vp.window_status, vp.tiktok_url,
    v_total AS total_count
  FROM public.v_video_performance vp
  WHERE vp.published_at::date BETWEEN p_from AND p_to
    AND (p_campaign_ids IS NULL OR vp.campaign_id = ANY(p_campaign_ids))
    AND (p_creator_ids  IS NULL OR vp.creator_id  = ANY(p_creator_ids))
  ORDER BY
    CASE WHEN p_sort_by='views'      AND p_sort_dir='desc' THEN vp.effective_views END DESC NULLS LAST,
    CASE WHEN p_sort_by='views'      AND p_sort_dir='asc'  THEN vp.effective_views END ASC  NULLS LAST,
    CASE WHEN p_sort_by='likes'      AND p_sort_dir='desc' THEN vp.likes END DESC NULLS LAST,
    CASE WHEN p_sort_by='likes'      AND p_sort_dir='asc'  THEN vp.likes END ASC  NULLS LAST,
    CASE WHEN p_sort_by='comments'   AND p_sort_dir='desc' THEN vp.comments END DESC NULLS LAST,
    CASE WHEN p_sort_by='comments'   AND p_sort_dir='asc'  THEN vp.comments END ASC  NULLS LAST,
    CASE WHEN p_sort_by='published'  AND p_sort_dir='desc' THEN vp.published_at END DESC NULLS LAST,
    CASE WHEN p_sort_by='published'  AND p_sort_dir='asc'  THEN vp.published_at END ASC  NULLS LAST,
    CASE WHEN p_sort_by='engagement' AND p_sort_dir='desc' THEN vp.engagement_pct END DESC NULLS LAST,
    CASE WHEN p_sort_by='engagement' AND p_sort_dir='asc'  THEN vp.engagement_pct END ASC  NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_videos(date, date, uuid[], uuid[], text, text, int, int) TO authenticated;

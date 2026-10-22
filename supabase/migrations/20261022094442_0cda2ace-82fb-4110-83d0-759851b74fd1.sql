CREATE OR REPLACE VIEW public.v_video_performance WITH (security_invoker = true) AS
 SELECT v.id, v.tiktok_video_id, v.tiktok_account_id, v.published_at, v.window_expires_at, v.window_closed,
    v.views, v.views_final, v.likes, v.comments, v.last_scraped_at,
    ta.username AS account_username, ta.account_type, ta.is_active AS account_active, ta.creator_id,
    cr.name AS creator_name, cr.creator_cpm, cr.creator_fixed, cr.status AS creator_status,
    ta.campaign_id, c.name AS campaign_name, c.client_name, c.client_cpm, c.video_views_cap,
    c.start_date AS campaign_start_date,
    CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END AS raw_effective_views,
    CASE WHEN c.video_views_cap IS NOT NULL AND c.video_views_cap > 0
      THEN LEAST(CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END, c.video_views_cap)
      ELSE CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END
    END AS effective_views,
    COALESCE(v.likes, 0) + COALESCE(v.comments, 0) AS total_engagements,
    CASE WHEN COALESCE(v.views, 0) > 0 THEN round((COALESCE(v.likes, 0) + COALESCE(v.comments, 0))::numeric / v.views::numeric * 100::numeric, 2) ELSE 0::numeric END AS engagement_pct,
    CASE WHEN v.window_closed THEN 'closed'::text
         WHEN v.window_expires_at IS NULL THEN 'open'::text
         WHEN v.window_expires_at <= now() THEN 'closed'::text
         WHEN v.window_expires_at <= (now() + '24:00:00'::interval) THEN 'closing'::text
         ELSE 'open'::text END AS window_status,
    EXTRACT(epoch FROM now() - v.published_at) / 86400.0 AS age_days,
    (('https://www.tiktok.com/@'::text || ta.username) || '/video/'::text) || v.tiktok_video_id AS tiktok_url,
    COALESCE(v.shares, 0) AS shares,
    COALESCE(v.saves, 0) AS saves
   FROM videos v
     JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id
     LEFT JOIN creators cr ON cr.id = ta.creator_id
     LEFT JOIN campaigns c ON c.id = ta.campaign_id;

CREATE OR REPLACE FUNCTION public.get_video_analytics(p_from date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date, p_to date DEFAULT CURRENT_DATE, p_campaign_ids uuid[] DEFAULT NULL::uuid[], p_creator_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role) OR public.has_role(auth.uid(), 'campaign_manager'::app_role)) THEN
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
      COALESCE(SUM(shares), 0)::bigint AS total_shares,
      COALESCE(SUM(saves), 0)::bigint AS total_saves,
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
    SELECT campaign_id, MAX(campaign_name) AS campaign_name, MAX(client_name) AS client_name,
      COUNT(*)::int AS video_count,
      COALESCE(SUM(effective_views), 0)::bigint AS total_views,
      COALESCE(SUM(likes + comments), 0)::bigint AS total_engagements,
      CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(effective_views))::bigint ELSE 0 END AS avg_views_per_video
    FROM base WHERE campaign_id IS NOT NULL
    GROUP BY campaign_id ORDER BY total_views DESC LIMIT 20
  ),
  by_creator AS (
    SELECT creator_id, MAX(creator_name) AS creator_name,
      COUNT(*)::int AS video_count,
      COALESCE(SUM(effective_views), 0)::bigint AS total_views,
      COALESCE(SUM(likes + comments), 0)::bigint AS total_engagements,
      CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(effective_views))::bigint ELSE 0 END AS avg_views_per_video
    FROM base WHERE creator_id IS NOT NULL
    GROUP BY creator_id ORDER BY total_views DESC LIMIT 20
  ),
  by_day AS (
    SELECT published_at::date AS day,
      COUNT(*)::int AS video_count,
      COALESCE(SUM(effective_views), 0)::bigint AS total_views,
      COALESCE(SUM(likes + comments), 0)::bigint AS total_engagements
    FROM base GROUP BY 1 ORDER BY 1
  ),
  top_video AS (
    SELECT id, tiktok_video_id, account_username, creator_name, campaign_name,
           effective_views, likes, comments, shares, saves, published_at, tiktok_url, window_status
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
$function$;

DROP FUNCTION IF EXISTS public.get_top_videos(date, date, uuid[], uuid[], text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_top_videos(p_from date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date, p_to date DEFAULT CURRENT_DATE, p_campaign_ids uuid[] DEFAULT NULL::uuid[], p_creator_ids uuid[] DEFAULT NULL::uuid[], p_sort_by text DEFAULT 'views'::text, p_sort_dir text DEFAULT 'desc'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, tiktok_video_id text, account_username text, creator_id uuid, creator_name text, campaign_id uuid, campaign_name text, client_name text, published_at timestamp with time zone, effective_views bigint, raw_views integer, likes integer, comments integer, shares integer, saves integer, engagement_pct numeric, window_status text, tiktok_url text, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_total bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role) OR public.has_role(auth.uid(), 'campaign_manager'::app_role)) THEN
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
    vp.views AS raw_views, vp.likes, vp.comments, vp.shares, vp.saves,
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
    CASE WHEN p_sort_by='shares'     AND p_sort_dir='desc' THEN vp.shares END DESC NULLS LAST,
    CASE WHEN p_sort_by='shares'     AND p_sort_dir='asc'  THEN vp.shares END ASC  NULLS LAST,
    CASE WHEN p_sort_by='saves'      AND p_sort_dir='desc' THEN vp.saves END DESC NULLS LAST,
    CASE WHEN p_sort_by='saves'      AND p_sort_dir='asc'  THEN vp.saves END ASC  NULLS LAST,
    CASE WHEN p_sort_by='published'  AND p_sort_dir='desc' THEN vp.published_at END DESC NULLS LAST,
    CASE WHEN p_sort_by='published'  AND p_sort_dir='asc'  THEN vp.published_at END ASC  NULLS LAST,
    CASE WHEN p_sort_by='engagement' AND p_sort_dir='desc' THEN vp.engagement_pct END DESC NULLS LAST,
    CASE WHEN p_sort_by='engagement' AND p_sort_dir='asc'  THEN vp.engagement_pct END ASC  NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_top_videos(date, date, uuid[], uuid[], text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_videos(date, date, uuid[], uuid[], text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_operator_analytics(p_from date, p_to date, p_campaign_ids uuid[] DEFAULT NULL::uuid[], p_creator_ids uuid[] DEFAULT NULL::uuid[], p_account_ids uuid[] DEFAULT NULL::uuid[], p_format text DEFAULT NULL::text, p_window text DEFAULT NULL::text, p_min_views integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  PERFORM public._operator_guard();
  WITH ov AS (
    SELECT * FROM public._operator_videos(p_from,p_to,p_campaign_ids,p_creator_ids,p_account_ids,p_format,p_window,p_min_views) f
    WHERE p_window IS NULL OR f.window_status = p_window
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object('videos', count(*), 'views', coalesce(sum(views),0),
        'likes', coalesce(sum(likes),0), 'comments', coalesce(sum(comments),0), 'shares', coalesce(sum(shares),0), 'saves', coalesce(sum(saves),0),
        'avg_views', coalesce(round(avg(views)),0),
        'engagement_pct', CASE WHEN sum(views) > 0 THEN round((sum(likes+comments+shares)::numeric / sum(views)) * 100, 2) ELSE 0 END,
        'creators', count(DISTINCT creator_id), 'accounts', count(DISTINCT account_id)) FROM ov),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('date', d, 'videos', n, 'views', s) ORDER BY d) FROM
        (SELECT (published_at AT TIME ZONE 'UTC')::date d, count(*) n, sum(views) s FROM ov GROUP BY 1) x), '[]'::jsonb),
    'by_campaign', coalesce((SELECT jsonb_agg(jsonb_build_object('id', campaign_id, 'name', campaign_name, 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT campaign_id, campaign_name, count(*) n, sum(views) s FROM ov GROUP BY 1,2) x), '[]'::jsonb),
    'by_creator', coalesce((SELECT jsonb_agg(jsonb_build_object('id', creator_id, 'name', coalesce(creator_name,'-'), 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT creator_id, creator_name, count(*) n, sum(views) s FROM ov GROUP BY 1,2 ORDER BY 4 DESC LIMIT 20) x), '[]'::jsonb),
    'by_account', coalesce((SELECT jsonb_agg(jsonb_build_object('id', account_id, 'name', username, 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT account_id, username, count(*) n, sum(views) s FROM ov GROUP BY 1,2 ORDER BY 4 DESC LIMIT 20) x), '[]'::jsonb),
    'by_format', coalesce((SELECT jsonb_agg(jsonb_build_object('name', coalesce(content_tag,'-'), 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT content_tag, count(*) n, sum(views) s FROM ov GROUP BY 1) x), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.get_operator_video_list(p_from date, p_to date, p_campaign_ids uuid[] DEFAULT NULL::uuid[], p_creator_ids uuid[] DEFAULT NULL::uuid[], p_account_ids uuid[] DEFAULT NULL::uuid[], p_format text DEFAULT NULL::text, p_window text DEFAULT NULL::text, p_min_views integer DEFAULT NULL::integer, p_sort text DEFAULT 'views'::text, p_dir text DEFAULT 'desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  PERFORM public._operator_guard();
  WITH f AS (
    SELECT *, CASE WHEN views > 0 THEN round(((likes+comments+shares)::numeric / views) * 100, 2) ELSE 0 END AS er
    FROM public._operator_videos(p_from,p_to,p_campaign_ids,p_creator_ids,p_account_ids,p_format,p_window,p_min_views) x
    WHERE p_window IS NULL OR x.window_status = p_window
  ), o AS (
    SELECT * FROM f ORDER BY
      CASE WHEN p_dir = 'asc' THEN CASE p_sort WHEN 'likes' THEN likes WHEN 'comments' THEN comments WHEN 'shares' THEN shares WHEN 'saves' THEN saves WHEN 'published' THEN extract(epoch FROM published_at)::bigint WHEN 'engagement' THEN (er*100)::bigint ELSE views END END ASC NULLS LAST,
      CASE WHEN p_dir <> 'asc' THEN CASE p_sort WHEN 'likes' THEN likes WHEN 'comments' THEN comments WHEN 'shares' THEN shares WHEN 'saves' THEN saves WHEN 'published' THEN extract(epoch FROM published_at)::bigint WHEN 'engagement' THEN (er*100)::bigint ELSE views END END DESC NULLS LAST,
      id
    LIMIT greatest(1, least(p_limit, 200)) OFFSET greatest(0, p_offset)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'tiktok_video_id', tiktok_video_id, 'username', username,
        'creator_name', creator_name, 'campaign_name', campaign_name, 'published_at', published_at, 'views', views,
        'likes', likes, 'comments', comments, 'shares', shares, 'saves', saves, 'engagement_pct', er, 'content_tag', content_tag,
        'caption', caption, 'window_status', window_status)) FROM o), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $function$;

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
    'shares_1d', COALESCE((SELECT sum(v.shares) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_1d), 0),
    'shares_7d', COALESCE((SELECT sum(v.shares) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_7d), 0),
    'shares_30d', COALESCE((SELECT sum(v.shares) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_30d), 0),
    'shares_90d', COALESCE((SELECT sum(v.shares) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_90d), 0),
    'saves_1d', COALESCE((SELECT sum(v.saves) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_1d), 0),
    'saves_7d', COALESCE((SELECT sum(v.saves) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_7d), 0),
    'saves_30d', COALESCE((SELECT sum(v.saves) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_30d), 0),
    'saves_90d', COALESCE((SELECT sum(v.saves) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_90d), 0),
    'videos_today', (SELECT count(*) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_today_start),
    'avg_videos_per_day_30d', (SELECT COALESCE(round(count(*)::numeric / GREATEST(1, 30), 1), 0) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id AND v.published_at >= v_30d),
    'total_videos', (SELECT count(*) FROM videos v JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id WHERE ta.campaign_id = v_camp.id)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
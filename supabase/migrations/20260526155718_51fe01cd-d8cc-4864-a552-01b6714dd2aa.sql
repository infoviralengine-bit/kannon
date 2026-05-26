
-- Indexes to speed up time-based and per-account video lookups
CREATE INDEX IF NOT EXISTS idx_videos_published_at_desc ON public.videos (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_account_published ON public.videos (tiktok_account_id, published_at DESC);

CREATE OR REPLACE FUNCTION public.get_campaign_manager_data(p_period text DEFAULT '30d')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int;
  v_now timestamptz := now();
  v_cur_start timestamptz;
  v_cur_end timestamptz := v_now;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_result jsonb;
BEGIN
  -- Auth check
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'team'::app_role) OR
    has_role(auth.uid(), 'campaign_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_days := CASE p_period
    WHEN '7d'  THEN 7
    WHEN '90d' THEN 90
    ELSE 30
  END;

  v_cur_start  := v_now - (v_days || ' days')::interval;
  v_prev_end   := v_cur_start;
  v_prev_start := v_cur_start - (v_days || ' days')::interval;

  WITH
  enriched_all AS (
    SELECT
      v.id,
      v.tiktok_video_id,
      v.tiktok_account_id,
      COALESCE(v.views, 0)    AS views,
      COALESCE(v.likes, 0)    AS likes,
      COALESCE(v.comments, 0) AS comments,
      v.shares,
      v.saves,
      v.duration_sec,
      v.content_tag,
      v.published_at,
      ta.username,
      ta.creator_id,
      ta.campaign_id,
      cr.name AS creator_name,
      cm.name AS campaign_name,
      GREATEST(0.5, EXTRACT(EPOCH FROM (v_now - v.published_at)) / 86400.0) AS days_since,
      CASE WHEN COALESCE(v.views,0) = 0 THEN 0
           ELSE ((COALESCE(v.likes,0) + COALESCE(v.comments,0))::numeric / v.views) * 100
      END AS engagement_rate,
      CASE WHEN COALESCE(v.views,0) = 0 THEN 0
           ELSE ((COALESCE(v.saves,0)*3 + COALESCE(v.shares,0)*2 + COALESCE(v.comments,0))::numeric / v.views) * 1000
      END AS quality_score
    FROM videos v
    JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id
    LEFT JOIN creators cr  ON cr.id = ta.creator_id
    LEFT JOIN campaigns cm ON cm.id = ta.campaign_id
  ),
  cur AS (SELECT * FROM enriched_all WHERE published_at >= v_cur_start  AND published_at < v_cur_end),
  prv AS (SELECT * FROM enriched_all WHERE published_at >= v_prev_start AND published_at < v_prev_end),

  -- KPIs
  kpi AS (
    SELECT
      (SELECT COALESCE(SUM(views), 0)::bigint FROM cur) AS total_views,
      (SELECT COALESCE(SUM(views), 0)::bigint FROM prv) AS prev_total_views,
      (SELECT COUNT(DISTINCT creator_id)::int FROM cur WHERE creator_id IS NOT NULL) AS active_creators,
      (SELECT COUNT(DISTINCT creator_id)::int FROM prv WHERE creator_id IS NOT NULL) AS prev_active_creators,
      (SELECT COUNT(*)::int FROM cur) AS published_content,
      (SELECT COUNT(*)::int FROM prv) AS prev_published_content,
      (SELECT COALESCE(AVG(client_cpm), 0)::numeric FROM campaigns WHERE status = 'active' AND COALESCE(client_cpm, 0) > 0) AS avg_cpm
  ),

  -- Campaign summaries (only active campaigns)
  camp_sum AS (
    SELECT
      c.id, c.name,
      COALESCE((SELECT SUM(views) FROM cur WHERE campaign_id = c.id), 0)::bigint AS views,
      COALESCE((SELECT SUM(views) FROM prv WHERE campaign_id = c.id), 0)::bigint AS prev_views,
      COALESCE((
        SELECT COUNT(*) FROM campaign_creators cc
        JOIN creators cr2 ON cr2.id = cc.creator_id
        WHERE cc.campaign_id = c.id AND cr2.status = 'active'
      ), 0)::int AS active_creators
    FROM campaigns c
    WHERE c.status = 'active'
  ),

  -- Daily views per campaign (only for the current period, days bucket)
  day_series AS (
    SELECT generate_series(
      date_trunc('day', v_cur_start),
      date_trunc('day', v_cur_end - interval '1 day'),
      interval '1 day'
    )::date AS d
  ),
  daily_raw AS (
    SELECT
      ds.d AS date,
      COALESCE(cur.campaign_name, cur.campaign_id::text) AS campaign_label,
      COALESCE(SUM(cur.views), 0)::bigint AS views
    FROM day_series ds
    LEFT JOIN cur ON cur.published_at::date = ds.d AND cur.campaign_id IS NOT NULL
    GROUP BY ds.d, COALESCE(cur.campaign_name, cur.campaign_id::text)
  ),
  daily_views AS (
    SELECT
      to_char(date, 'YYYY-MM-DD') AS date,
      jsonb_object_agg(campaign_label, views) FILTER (WHERE campaign_label IS NOT NULL) AS camps
    FROM daily_raw
    GROUP BY date
    ORDER BY date
  ),

  -- Detailed creator ranking from current period
  creator_detail AS (
    SELECT
      cur.creator_id,
      MAX(cur.creator_name) AS creator_name,
      SUM(cur.views)::bigint AS views,
      COUNT(*)::int AS video_count,
      (SUM(cur.views) / NULLIF(COUNT(*), 0))::bigint AS avg_views_per_video,
      AVG(cur.engagement_rate)::numeric AS engagement_rate,
      AVG(cur.quality_score)::numeric AS quality_score,
      MAX(cur.views)::bigint AS top_video_views,
      COALESCE((SELECT SUM(views) FROM prv WHERE creator_id = cur.creator_id), 0)::bigint AS prev_views
    FROM cur
    WHERE cur.creator_id IS NOT NULL
    GROUP BY cur.creator_id
  ),

  -- Spark data: last 7 days per creator
  spark AS (
    SELECT
      e.creator_id,
      to_char(d.day, 'YYYY-MM-DD') AS day,
      COALESCE(SUM(e.views), 0)::bigint AS views
    FROM (
      SELECT generate_series(
        date_trunc('day', v_now - interval '6 days'),
        date_trunc('day', v_now),
        interval '1 day'
      )::date AS day
    ) d
    LEFT JOIN enriched_all e
      ON e.published_at::date = d.day
     AND e.published_at >= v_now - interval '7 days'
     AND e.creator_id IS NOT NULL
    GROUP BY e.creator_id, d.day
  ),
  spark_agg AS (
    SELECT creator_id, jsonb_agg(views ORDER BY day) AS daily
    FROM spark
    WHERE creator_id IS NOT NULL
    GROUP BY creator_id
  ),

  -- Format stats: prefer content_tag, fall back to duration bucket
  fmt AS (
    SELECT
      CASE
        WHEN cur.content_tag IS NOT NULL THEN cur.content_tag
        WHEN cur.duration_sec IS NULL THEN NULL
        WHEN cur.duration_sec <= 15 THEN 'short'
        WHEN cur.duration_sec <= 30 THEN 'medium'
        ELSE 'long'
      END AS tag,
      cur.views,
      cur.engagement_rate,
      cur.quality_score
    FROM cur
  ),
  fmt_stats AS (
    SELECT
      tag,
      COUNT(*)::int AS video_count,
      ROUND(AVG(views))::bigint AS avg_views,
      AVG(engagement_rate)::numeric AS avg_engagement,
      AVG(quality_score)::numeric AS avg_quality_score
    FROM fmt
    WHERE tag IS NOT NULL
    GROUP BY tag
  ),

  -- Viral videos: top 10 by viral velocity over ALL videos with views > 5000
  viral AS (
    SELECT
      id, tiktok_video_id, tiktok_account_id, username, creator_id, creator_name,
      campaign_id, campaign_name, views, likes, comments, shares, saves,
      duration_sec, content_tag, published_at, engagement_rate, quality_score,
      (views / days_since) AS viral_velocity
    FROM enriched_all
    WHERE views > 5000
    ORDER BY viral_velocity DESC
    LIMIT 10
  )

  SELECT jsonb_build_object(
    'totalViews',           kpi.total_views,
    'prevTotalViews',       kpi.prev_total_views,
    'activeCreators',       kpi.active_creators,
    'prevActiveCreators',   kpi.prev_active_creators,
    'publishedContent',     kpi.published_content,
    'prevPublishedContent', kpi.prev_published_content,
    'avgCpm',               kpi.avg_cpm,
    'prevAvgCpm',           kpi.avg_cpm,

    'campaigns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'views', views,
        'prevViews', prev_views, 'activeCreators', active_creators
      ) ORDER BY name)
      FROM camp_sum
    ), '[]'::jsonb),

    'dailyViews', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('date', date) || COALESCE(camps, '{}'::jsonb)
        ORDER BY date
      )
      FROM daily_views
    ), '[]'::jsonb),

    'videos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'videoId',        id,
        'tiktokVideoId',  tiktok_video_id,
        'username',       COALESCE(username, ''),
        'creatorId',      COALESCE(creator_id::text, ''),
        'creatorName',    COALESCE(creator_name, 'Sconosciuto'),
        'campaignId',     COALESCE(campaign_id::text, ''),
        'campaignName',   COALESCE(campaign_name, ''),
        'views',          views,
        'likes',          likes,
        'comments',       comments,
        'shares',         shares,
        'saves',          saves,
        'durationSec',    duration_sec,
        'contentTag',     content_tag,
        'publishedAt',    published_at,
        'viralVelocity',  (views / days_since),
        'engagementRate', engagement_rate,
        'qualityScore',   quality_score
      ) ORDER BY published_at DESC)
      FROM cur
    ), '[]'::jsonb),

    'allVideos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'videoId',        id,
        'tiktokVideoId',  tiktok_video_id,
        'username',       COALESCE(username, ''),
        'creatorId',      COALESCE(creator_id::text, ''),
        'creatorName',    COALESCE(creator_name, '—'),
        'campaignId',     COALESCE(campaign_id::text, ''),
        'campaignName',   COALESCE(campaign_name, '—'),
        'views',          views,
        'likes',          likes,
        'comments',       comments,
        'shares',         shares,
        'saves',          saves,
        'durationSec',    duration_sec,
        'contentTag',     content_tag,
        'publishedAt',    published_at,
        'viralVelocity',  (views / days_since),
        'engagementRate', engagement_rate,
        'qualityScore',   quality_score
      ))
      FROM enriched_all
    ), '[]'::jsonb),

    'creatorRanking', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'creatorName', cd.creator_name,
        'views',       cd.views,
        'dailyViews',  COALESCE(sa.daily, '[0,0,0,0,0,0,0]'::jsonb)
      ) ORDER BY cd.views DESC)
      FROM creator_detail cd
      LEFT JOIN spark_agg sa ON sa.creator_id = cd.creator_id
      WHERE cd.views > 0
    ), '[]'::jsonb),

    'creatorRankingDetailed', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'creatorId',         creator_id,
        'creatorName',       creator_name,
        'views',             views,
        'prevViews',         prev_views,
        'videoCount',        video_count,
        'avgViewsPerVideo',  avg_views_per_video,
        'engagementRate',    engagement_rate,
        'qualityScore',      quality_score,
        'topVideoViews',     top_video_views
      ) ORDER BY views DESC)
      FROM creator_detail
      WHERE views > 0
    ), '[]'::jsonb),

    'formatStats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tag',             tag,
        'videoCount',      video_count,
        'avgViews',        avg_views,
        'avgEngagement',   avg_engagement,
        'avgQualityScore', avg_quality_score
      ) ORDER BY avg_views DESC)
      FROM fmt_stats
    ), '[]'::jsonb),

    'viralVideos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'videoId',        id,
        'tiktokVideoId',  tiktok_video_id,
        'username',       COALESCE(username, ''),
        'creatorId',      COALESCE(creator_id::text, ''),
        'creatorName',    COALESCE(creator_name, '—'),
        'campaignId',     COALESCE(campaign_id::text, ''),
        'campaignName',   COALESCE(campaign_name, '—'),
        'views',          views,
        'likes',          likes,
        'comments',       comments,
        'shares',         shares,
        'saves',          saves,
        'durationSec',    duration_sec,
        'contentTag',     content_tag,
        'publishedAt',    published_at,
        'viralVelocity',  viral_velocity,
        'engagementRate', engagement_rate,
        'qualityScore',   quality_score
      ) ORDER BY viral_velocity DESC)
      FROM viral
    ), '[]'::jsonb),

    'avgEngagementRate', COALESCE((SELECT AVG(engagement_rate) FROM cur), 0),
    'avgQualityScore',   COALESCE((SELECT AVG(quality_score) FROM cur), 0)
  )
  INTO v_result
  FROM kpi;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_manager_data(text) TO authenticated;

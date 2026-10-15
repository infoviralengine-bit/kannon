CREATE OR REPLACE FUNCTION public._operator_guard() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'operator'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
END $$;

-- Active campaigns overview, no financial fields
CREATE OR REPLACE FUNCTION public.get_operator_campaigns() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  PERFORM public._operator_guard();
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'start_date'), '[]'::jsonb) INTO r FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'name', c.name, 'client_name', c.client_name,
      'logo_url', coalesce(co.logo_url, ac.logo_url),
      'start_date', c.start_date, 'end_date', c.end_date,
      'creator_count', (SELECT count(DISTINCT cid) FROM (
          SELECT creator_id cid FROM campaign_creators WHERE campaign_id = c.id
          UNION SELECT creator_id FROM tiktok_accounts WHERE campaign_id = c.id AND creator_id IS NOT NULL) s),
      'account_count', (SELECT count(*) FROM tiktok_accounts WHERE campaign_id = c.id),
      'video_count', (SELECT count(*) FROM videos v JOIN tiktok_accounts a ON a.id = v.tiktok_account_id WHERE a.campaign_id = c.id),
      'total_views', (SELECT coalesce(sum(coalesce(v.views,0)),0) FROM videos v JOIN tiktok_accounts a ON a.id = v.tiktok_account_id WHERE a.campaign_id = c.id)
    ) x
    FROM campaigns c
    LEFT JOIN companies co ON co.id = c.company_id
    LEFT JOIN allocation_campaigns ac ON ac.campaign_id = c.id
    WHERE c.status = 'active'
  ) q;
  RETURN r;
END $$;

-- Creators and accounts of one active campaign
CREATE OR REPLACE FUNCTION public.get_operator_campaign_detail(p_campaign_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  PERFORM public._operator_guard();
  IF NOT EXISTS (SELECT 1 FROM campaigns WHERE id = p_campaign_id AND status = 'active') THEN
    RETURN NULL;
  END IF;
  WITH acc AS (
    SELECT a.id, a.username, a.is_active, a.creator_id,
      (SELECT count(*) FROM videos v WHERE v.tiktok_account_id = a.id) AS video_count,
      (SELECT coalesce(sum(coalesce(v.views,0)),0) FROM videos v WHERE v.tiktok_account_id = a.id) AS total_views,
      (SELECT max(v.published_at) FROM videos v WHERE v.tiktok_account_id = a.id) AS last_video_at
    FROM tiktok_accounts a WHERE a.campaign_id = p_campaign_id
  ), cr AS (
    SELECT DISTINCT cid FROM (
      SELECT creator_id cid FROM campaign_creators WHERE campaign_id = p_campaign_id
      UNION SELECT creator_id FROM acc WHERE creator_id IS NOT NULL) s
  )
  SELECT jsonb_build_object(
    'campaign', (SELECT jsonb_build_object('id', c.id, 'name', c.name, 'client_name', c.client_name,
        'start_date', c.start_date, 'end_date', c.end_date,
        'logo_url', (SELECT coalesce(co.logo_url, ac.logo_url) FROM campaigns c2 LEFT JOIN companies co ON co.id = c2.company_id LEFT JOIN allocation_campaigns ac ON ac.campaign_id = c2.id WHERE c2.id = c.id))
      FROM campaigns c WHERE c.id = p_campaign_id),
    'creators', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', k.id, 'name', k.name, 'status', k.status,
        'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'username', a.username, 'is_active', a.is_active,
            'video_count', a.video_count, 'total_views', a.total_views, 'last_video_at', a.last_video_at) ORDER BY a.username)
          FROM acc a WHERE a.creator_id = k.id), '[]'::jsonb)
      ) ORDER BY k.name) FROM cr JOIN creators k ON k.id = cr.cid), '[]'::jsonb),
    'unassigned_accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'username', a.username, 'is_active', a.is_active,
        'video_count', a.video_count, 'total_views', a.total_views, 'last_video_at', a.last_video_at) ORDER BY a.username)
      FROM acc a WHERE a.creator_id IS NULL), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

-- Filtered video base (active campaigns only, real views)
CREATE OR REPLACE FUNCTION public._operator_videos(
  p_from date, p_to date, p_campaign_ids uuid[], p_creator_ids uuid[], p_account_ids uuid[],
  p_format text, p_window text, p_min_views integer)
RETURNS TABLE(id uuid, tiktok_video_id text, account_id uuid, username text, creator_id uuid, creator_name text,
  campaign_id uuid, campaign_name text, published_at timestamptz, views bigint, likes bigint, comments bigint,
  shares bigint, saves bigint, content_tag text, caption text, window_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.tiktok_video_id, a.id, a.username, k.id, k.name, c.id, c.name, v.published_at,
    coalesce(v.views,0)::bigint, coalesce(v.likes,0)::bigint, coalesce(v.comments,0)::bigint,
    coalesce(v.shares,0)::bigint, coalesce(v.saves,0)::bigint, v.content_tag, v.caption,
    CASE WHEN v.window_closed OR coalesce(v.window_expires_at, v.published_at + interval '30 days') <= now() THEN 'closed'
         WHEN coalesce(v.window_expires_at, v.published_at + interval '30 days') <= now() + interval '24 hours' THEN 'closing'
         ELSE 'open' END
  FROM videos v
  JOIN tiktok_accounts a ON a.id = v.tiktok_account_id
  JOIN campaigns c ON c.id = a.campaign_id AND c.status = 'active'
  LEFT JOIN creators k ON k.id = a.creator_id
  WHERE (p_from IS NULL OR v.published_at >= p_from::timestamptz)
    AND (p_to IS NULL OR v.published_at < (p_to + 1)::timestamptz)
    AND (p_campaign_ids IS NULL OR cardinality(p_campaign_ids) = 0 OR c.id = ANY(p_campaign_ids))
    AND (p_creator_ids IS NULL OR cardinality(p_creator_ids) = 0 OR k.id = ANY(p_creator_ids))
    AND (p_account_ids IS NULL OR cardinality(p_account_ids) = 0 OR a.id = ANY(p_account_ids))
    AND (p_format IS NULL OR v.content_tag = p_format)
    AND (p_min_views IS NULL OR coalesce(v.views,0) >= p_min_views)
$$;

CREATE OR REPLACE FUNCTION public.get_operator_analytics(
  p_from date, p_to date, p_campaign_ids uuid[] DEFAULT NULL, p_creator_ids uuid[] DEFAULT NULL,
  p_account_ids uuid[] DEFAULT NULL, p_format text DEFAULT NULL, p_window text DEFAULT NULL, p_min_views integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  PERFORM public._operator_guard();
  CREATE TEMP TABLE IF NOT EXISTS _ov ON COMMIT DROP AS SELECT * FROM public._operator_videos(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL) WITH NO DATA;
  TRUNCATE _ov;
  INSERT INTO _ov SELECT * FROM public._operator_videos(p_from,p_to,p_campaign_ids,p_creator_ids,p_account_ids,p_format,p_window,p_min_views) f
    WHERE p_window IS NULL OR f.window_status = p_window;
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object('videos', count(*), 'views', coalesce(sum(views),0),
        'likes', coalesce(sum(likes),0), 'comments', coalesce(sum(comments),0), 'shares', coalesce(sum(shares),0),
        'avg_views', coalesce(round(avg(views)),0),
        'engagement_pct', CASE WHEN sum(views) > 0 THEN round((sum(likes+comments+shares)::numeric / sum(views)) * 100, 2) ELSE 0 END,
        'creators', count(DISTINCT creator_id), 'accounts', count(DISTINCT account_id)) FROM _ov),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('date', d, 'videos', n, 'views', s) ORDER BY d) FROM
        (SELECT (published_at AT TIME ZONE 'UTC')::date d, count(*) n, sum(views) s FROM _ov GROUP BY 1) x), '[]'::jsonb),
    'by_campaign', coalesce((SELECT jsonb_agg(jsonb_build_object('id', campaign_id, 'name', campaign_name, 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT campaign_id, campaign_name, count(*) n, sum(views) s FROM _ov GROUP BY 1,2) x), '[]'::jsonb),
    'by_creator', coalesce((SELECT jsonb_agg(jsonb_build_object('id', creator_id, 'name', coalesce(creator_name,'-'), 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT creator_id, creator_name, count(*) n, sum(views) s FROM _ov GROUP BY 1,2 ORDER BY 4 DESC LIMIT 20) x), '[]'::jsonb),
    'by_account', coalesce((SELECT jsonb_agg(jsonb_build_object('id', account_id, 'name', username, 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT account_id, username, count(*) n, sum(views) s FROM _ov GROUP BY 1,2 ORDER BY 4 DESC LIMIT 20) x), '[]'::jsonb),
    'by_format', coalesce((SELECT jsonb_agg(jsonb_build_object('name', coalesce(content_tag,'-'), 'videos', n, 'views', s, 'avg_views', round(s::numeric/n)) ORDER BY s DESC) FROM
        (SELECT content_tag, count(*) n, sum(views) s FROM _ov GROUP BY 1) x), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.get_operator_video_list(
  p_from date, p_to date, p_campaign_ids uuid[] DEFAULT NULL, p_creator_ids uuid[] DEFAULT NULL,
  p_account_ids uuid[] DEFAULT NULL, p_format text DEFAULT NULL, p_window text DEFAULT NULL, p_min_views integer DEFAULT NULL,
  p_sort text DEFAULT 'views', p_dir text DEFAULT 'desc', p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  PERFORM public._operator_guard();
  WITH f AS (
    SELECT *, CASE WHEN views > 0 THEN round(((likes+comments+shares)::numeric / views) * 100, 2) ELSE 0 END AS er
    FROM public._operator_videos(p_from,p_to,p_campaign_ids,p_creator_ids,p_account_ids,p_format,p_window,p_min_views) x
    WHERE p_window IS NULL OR x.window_status = p_window
  ), o AS (
    SELECT * FROM f ORDER BY
      CASE WHEN p_dir = 'asc' THEN CASE p_sort WHEN 'likes' THEN likes WHEN 'comments' THEN comments WHEN 'shares' THEN shares WHEN 'published' THEN extract(epoch FROM published_at)::bigint WHEN 'engagement' THEN (er*100)::bigint ELSE views END END ASC NULLS LAST,
      CASE WHEN p_dir <> 'asc' THEN CASE p_sort WHEN 'likes' THEN likes WHEN 'comments' THEN comments WHEN 'shares' THEN shares WHEN 'published' THEN extract(epoch FROM published_at)::bigint WHEN 'engagement' THEN (er*100)::bigint ELSE views END END DESC NULLS LAST,
      id
    LIMIT greatest(1, least(p_limit, 200)) OFFSET greatest(0, p_offset)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'tiktok_video_id', tiktok_video_id, 'username', username,
        'creator_name', creator_name, 'campaign_name', campaign_name, 'published_at', published_at, 'views', views,
        'likes', likes, 'comments', comments, 'shares', shares, 'engagement_pct', er, 'content_tag', content_tag,
        'caption', caption, 'window_status', window_status)) FROM o), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public._operator_videos(date,date,uuid[],uuid[],uuid[],text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._operator_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_operator_campaigns() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_operator_campaign_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_operator_analytics(date,date,uuid[],uuid[],uuid[],text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_operator_video_list(date,date,uuid[],uuid[],uuid[],text,text,integer,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._operator_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operator_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operator_campaign_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operator_analytics(date,date,uuid[],uuid[],uuid[],text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operator_video_list(date,date,uuid[],uuid[],uuid[],text,text,integer,text,text,integer,integer) TO authenticated;
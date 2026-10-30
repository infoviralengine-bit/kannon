DROP FUNCTION IF EXISTS public.get_top_videos(date, date, uuid[], uuid[], text, text, int, int);

CREATE FUNCTION public.get_top_videos(
  p_from date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date,
  p_to date DEFAULT CURRENT_DATE,
  p_campaign_ids uuid[] DEFAULT NULL::uuid[],
  p_creator_ids uuid[] DEFAULT NULL::uuid[],
  p_sort_by text DEFAULT 'views'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, tiktok_video_id text, account_username text, creator_id uuid, creator_name text, campaign_id uuid, campaign_name text, client_name text, published_at timestamp with time zone, effective_views bigint, raw_views integer, likes integer, comments integer, shares integer, saves integer, engagement_pct numeric, window_status text, tiktok_url text, caption text, hashtags text[], audio_name text, total_count bigint)
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
    v.caption, v.hashtags, v.audio_name,
    v_total AS total_count
  FROM public.v_video_performance vp
  LEFT JOIN public.videos v ON v.id = vp.id
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
    CASE WHEN p_sort_by='engagement' AND p_sort_dir='asc'  THEN vp.engagement_pct END ASC  NULLS LAST,
    vp.id
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_top_videos(date, date, uuid[], uuid[], text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_videos(date, date, uuid[], uuid[], text, text, int, int) TO authenticated;
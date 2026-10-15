CREATE OR REPLACE FUNCTION public.get_operator_analytics(
  p_from date, p_to date, p_campaign_ids uuid[] DEFAULT NULL, p_creator_ids uuid[] DEFAULT NULL,
  p_account_ids uuid[] DEFAULT NULL, p_format text DEFAULT NULL, p_window text DEFAULT NULL, p_min_views integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  PERFORM public._operator_guard();
  WITH ov AS (
    SELECT * FROM public._operator_videos(p_from,p_to,p_campaign_ids,p_creator_ids,p_account_ids,p_format,p_window,p_min_views) f
    WHERE p_window IS NULL OR f.window_status = p_window
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object('videos', count(*), 'views', coalesce(sum(views),0),
        'likes', coalesce(sum(likes),0), 'comments', coalesce(sum(comments),0), 'shares', coalesce(sum(shares),0),
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
END $$;
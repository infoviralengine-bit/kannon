CREATE OR REPLACE FUNCTION public.low_view_video_eligible(p_views integer, p_published_at timestamptz, p_now timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT p_views IS NOT NULL AND p_views < 50 AND p_published_at >= p_now - interval '7 days' AND p_published_at <= p_now - interval '24 hours'
$$;
REVOKE ALL ON FUNCTION public.low_view_video_eligible(integer,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.low_view_video_eligible(integer,timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.get_account_signals()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
 WITH eligible AS (
 SELECT ta.id account_id, ta.username, ta.creator_id, ta.campaign_id, c.name campaign_name,
 v.id video_id,v.tiktok_video_id,v.views,v.published_at,v.last_scraped_at
 FROM public.tiktok_accounts ta
 LEFT JOIN public.campaigns c ON c.id=ta.campaign_id
 JOIN public.videos v ON v.tiktok_account_id=ta.id
 WHERE public.low_view_video_eligible(v.views,v.published_at,now())
 AND (
 public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'campaign_manager'::app_role)
 OR (public.has_role(auth.uid(),'operator'::app_role) AND c.status='active')
 OR (public.has_role(auth.uid(),'client'::app_role) AND c.client_profile_id=auth.uid())
 OR (public.has_role(auth.uid(),'creator'::app_role) AND EXISTS (SELECT 1 FROM public.creators cr WHERE cr.id=ta.creator_id AND cr.profile_id=auth.uid()))
 )
 ), grouped AS (
 SELECT account_id,username,creator_id,campaign_id,campaign_name,count(*)::integer low_count,least(count(*),3)::integer tier,
 jsonb_agg(jsonb_build_object('id',video_id,'tiktok_video_id',tiktok_video_id,'views',views,'published_at',published_at,'last_scraped_at',last_scraped_at) ORDER BY published_at DESC) videos
 FROM eligible GROUP BY account_id,username,creator_id,campaign_id,campaign_name
 ) SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY tier DESC,low_count DESC,username),'[]'::jsonb) INTO result FROM grouped;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_account_signals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_account_signals() TO authenticated,service_role;
DROP POLICY IF EXISTS read_brief_comments ON public.brief_comments;
CREATE POLICY read_brief_comments ON public.brief_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.video_briefs b WHERE b.id = brief_comments.brief_id));

DROP POLICY IF EXISTS read_brief_cr ON public.brief_change_requests;
CREATE POLICY read_brief_cr ON public.brief_change_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.video_briefs b WHERE b.id = brief_change_requests.brief_id));

DROP POLICY IF EXISTS read_brief_topics ON public.brief_topics;
CREATE POLICY read_brief_topics ON public.brief_topics FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.video_briefs b WHERE b.id = brief_topics.brief_id));

DROP POLICY IF EXISTS read_vbm ON public.video_brief_matches;
CREATE POLICY read_vbm ON public.video_brief_matches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.video_briefs b WHERE b.id = video_brief_matches.brief_id));

DROP POLICY IF EXISTS read_video_formats ON public.video_formats;
CREATE POLICY read_video_formats ON public.video_formats FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)
  OR public.has_role(auth.uid(),'campaign_manager'::app_role) OR public.has_role(auth.uid(),'operator'::app_role)
  OR EXISTS (SELECT 1 FROM public.video_briefs b WHERE b.format_id = video_formats.id)
);

DROP POLICY IF EXISTS read_topics ON public.content_topics;
CREATE POLICY read_topics ON public.content_topics FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)
  OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.brief_topics bt JOIN public.video_briefs b ON b.id = bt.brief_id WHERE bt.topic_id = content_topics.id)
);
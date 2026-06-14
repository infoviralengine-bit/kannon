-- =====================================================================
-- Super Prompt #4 · Calendario Contenuti
-- Central entity: video_briefs (replaces the "trend" concept).
-- Adds matching engine (video <-> brief), format propagation,
-- catalog (formats + topics), multi-portal RLS, and analytics RPCs.
-- =====================================================================

-- Ensure shared updated_at trigger fn exists (idempotent safety).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- A. videos: matching identifiers
-- ---------------------------------------------------------------------
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS audio_id   text NULL,
  ADD COLUMN IF NOT EXISTS audio_name text NULL,
  ADD COLUMN IF NOT EXISTS caption    text NULL,
  ADD COLUMN IF NOT EXISTS hashtags   text[] NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_videos_audio_id
  ON public.videos(audio_id) WHERE audio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_caption_trgm
  ON public.videos USING gin (caption gin_trgm_ops);

-- ---------------------------------------------------------------------
-- B. campaigns: performance thresholds
-- ---------------------------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS brief_threshold_views      bigint  NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS brief_threshold_engagement numeric NULL DEFAULT 5.0;

-- ---------------------------------------------------------------------
-- video_formats: add is_active + allow campaign_manager CRUD
-- (existing policy only covered admin/team)
-- ---------------------------------------------------------------------
ALTER TABLE public.video_formats
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "cm_manage_video_formats" ON public.video_formats;
CREATE POLICY "cm_manage_video_formats" ON public.video_formats
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'campaign_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'campaign_manager'::app_role));

-- Allow all authenticated roles to read formats (briefs reference them in
-- client/creator portals). Read-only.
DROP POLICY IF EXISTS "read_video_formats" ON public.video_formats;
CREATE POLICY "read_video_formats" ON public.video_formats
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- C. content_topics (catalog)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_all_topics" ON public.content_topics;
CREATE POLICY "staff_all_topics" ON public.content_topics
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  );

-- Read-only for everyone authenticated (topics shown in portals).
DROP POLICY IF EXISTS "read_topics" ON public.content_topics;
CREATE POLICY "read_topics" ON public.content_topics
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.content_topics (name) VALUES
  ('Pricing'),
  ('Onboarding'),
  ('Social Proof'),
  ('Pain Point'),
  ('Use Case'),
  ('Comparison')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------
-- D. video_briefs (central entity)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  planned_publish_date date NOT NULL,
  week_label text NULL,

  reference_type text NOT NULL DEFAULT 'video_audio'
    CHECK (reference_type IN ('video','audio','video_audio','format_audio','format')),
  reference_links jsonb NOT NULL DEFAULT '[]'::jsonb,

  audio_id text NULL,
  expected_caption_keywords text[] NULL,

  format_id uuid NULL REFERENCES public.video_formats(id) ON DELETE SET NULL,

  title text NULL,
  copy_text text NOT NULL,
  caption text NULL,
  hashtags text[] NULL,
  visual_note text NULL,

  threshold_views_override bigint NULL,
  threshold_engagement_override numeric NULL,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','archived')),

  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefs_campaign_date ON public.video_briefs(campaign_id, planned_publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_briefs_status        ON public.video_briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_audio_id      ON public.video_briefs(audio_id) WHERE audio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_briefs_format_id     ON public.video_briefs(format_id) WHERE format_id IS NOT NULL;

ALTER TABLE public.video_briefs ENABLE ROW LEVEL SECURITY;

-- Staff (admin + team + campaign_manager): full access
DROP POLICY IF EXISTS "staff_full_briefs" ON public.video_briefs;
CREATE POLICY "staff_full_briefs" ON public.video_briefs
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  );

-- Client: SELECT on in_review/approved/archived briefs of their campaign.
-- FK is campaigns.client_profile_id (= auth.uid()).
DROP POLICY IF EXISTS "client_read_own_briefs" ON public.video_briefs;
CREATE POLICY "client_read_own_briefs" ON public.video_briefs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'client'::app_role)
    AND status IN ('in_review','approved','archived')
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = video_briefs.campaign_id
        AND c.client_profile_id = auth.uid()
    )
  );

-- Client can approve their own in_review briefs (status -> approved).
-- Limited UPDATE; staff_full handles the rest.
DROP POLICY IF EXISTS "client_approve_own_briefs" ON public.video_briefs;
CREATE POLICY "client_approve_own_briefs" ON public.video_briefs
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'client'::app_role)
    AND status IN ('in_review','approved')
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = video_briefs.campaign_id
        AND c.client_profile_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('in_review','approved')
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = video_briefs.campaign_id
        AND c.client_profile_id = auth.uid()
    )
  );

-- Creator: SELECT on in_review/approved briefs of campaigns they belong to.
-- FK is creators.profile_id (= auth.uid()).
DROP POLICY IF EXISTS "creator_read_own_briefs" ON public.video_briefs;
CREATE POLICY "creator_read_own_briefs" ON public.video_briefs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'creator'::app_role)
    AND status IN ('in_review','approved')
    AND EXISTS (
      SELECT 1
      FROM public.campaign_creators cc
      JOIN public.creators cr ON cr.id = cc.creator_id
      WHERE cc.campaign_id = video_briefs.campaign_id
        AND cr.profile_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS video_briefs_updated_at ON public.video_briefs;
CREATE TRIGGER video_briefs_updated_at BEFORE UPDATE ON public.video_briefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- E. brief_topics (junction N:N)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brief_topics (
  brief_id uuid NOT NULL REFERENCES public.video_briefs(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (brief_id, topic_id)
);

ALTER TABLE public.brief_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_brief_topics" ON public.brief_topics;
CREATE POLICY "read_brief_topics" ON public.brief_topics
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_write_brief_topics" ON public.brief_topics;
CREATE POLICY "staff_write_brief_topics" ON public.brief_topics
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  );

-- ---------------------------------------------------------------------
-- F. brief_comments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brief_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.video_briefs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role text NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) < 5000),
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_comments_brief ON public.brief_comments(brief_id, created_at DESC);

ALTER TABLE public.brief_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_brief_comments" ON public.brief_comments;
CREATE POLICY "read_brief_comments" ON public.brief_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_write_own_comment" ON public.brief_comments;
CREATE POLICY "client_write_own_comment" ON public.brief_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND public.has_role(auth.uid(),'client'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.video_briefs b
      JOIN public.campaigns c ON c.id = b.campaign_id
      WHERE b.id = brief_id AND c.client_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff_write_comment" ON public.brief_comments;
CREATE POLICY "staff_write_comment" ON public.brief_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'team'::app_role)
      OR public.has_role(auth.uid(),'campaign_manager'::app_role)
    )
  );

DROP POLICY IF EXISTS "staff_resolve_comment" ON public.brief_comments;
CREATE POLICY "staff_resolve_comment" ON public.brief_comments
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  );

-- ---------------------------------------------------------------------
-- G. brief_change_requests
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brief_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.video_briefs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  proposed_copy_text text NULL,
  proposed_caption text NULL,
  proposed_hashtags text[] NULL,
  proposed_visual_note text NULL,
  reason text NOT NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  resolved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz NULL,
  resolution_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_cr_brief ON public.brief_change_requests(brief_id, status);

ALTER TABLE public.brief_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_brief_cr" ON public.brief_change_requests;
CREATE POLICY "read_brief_cr" ON public.brief_change_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_create_cr" ON public.brief_change_requests;
CREATE POLICY "client_create_cr" ON public.brief_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND public.has_role(auth.uid(),'client'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.video_briefs b
      JOIN public.campaigns c ON c.id = b.campaign_id
      WHERE b.id = brief_id AND c.client_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff_create_cr" ON public.brief_change_requests;
CREATE POLICY "staff_create_cr" ON public.brief_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'team'::app_role)
      OR public.has_role(auth.uid(),'campaign_manager'::app_role)
    )
  );

DROP POLICY IF EXISTS "staff_resolve_cr" ON public.brief_change_requests;
CREATE POLICY "staff_resolve_cr" ON public.brief_change_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  );

-- ---------------------------------------------------------------------
-- H. video_brief_matches (N:N video <-> brief)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_brief_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  brief_id uuid NOT NULL REFERENCES public.video_briefs(id) ON DELETE CASCADE,
  match_method text NOT NULL CHECK (match_method IN ('audio_id','caption_keywords','manual')),
  confidence numeric NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  matched_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(video_id, brief_id)
);

CREATE INDEX IF NOT EXISTS idx_vbm_video ON public.video_brief_matches(video_id);
CREATE INDEX IF NOT EXISTS idx_vbm_brief ON public.video_brief_matches(brief_id);

ALTER TABLE public.video_brief_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_vbm" ON public.video_brief_matches;
CREATE POLICY "read_vbm" ON public.video_brief_matches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_write_vbm" ON public.video_brief_matches;
CREATE POLICY "staff_write_vbm" ON public.video_brief_matches
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  );

-- ---------------------------------------------------------------------
-- Matching engine + format propagation
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_video_to_briefs(p_video_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_published   timestamptz;
  v_audio_id    text;
  v_caption     text;
  v_content_tag text;
  v_match_count int := 0;
  r record;
  v_method text;
  v_conf   numeric;
  v_kw_ok  boolean;
  kw       text;
  v_format_name text;
BEGIN
  SELECT ta.campaign_id, v.published_at, v.audio_id, v.caption, v.content_tag
    INTO v_campaign_id, v_published, v_audio_id, v_caption, v_content_tag
  FROM public.videos v
  JOIN public.tiktok_accounts ta ON ta.id = v.tiktok_account_id
  WHERE v.id = p_video_id;

  IF v_campaign_id IS NULL OR v_published IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT b.id, b.audio_id AS b_audio, b.expected_caption_keywords AS kws, b.format_id
    FROM public.video_briefs b
    WHERE b.campaign_id = v_campaign_id
      AND b.status IN ('in_review','approved')
      AND b.planned_publish_date
          BETWEEN (v_published::date - INTERVAL '14 days')
              AND (v_published::date + INTERVAL '14 days')
  LOOP
    v_method := NULL;
    v_conf   := NULL;

    IF v_audio_id IS NOT NULL AND r.b_audio IS NOT NULL AND v_audio_id = r.b_audio THEN
      v_method := 'audio_id';
      v_conf   := 1.0;
    ELSIF r.kws IS NOT NULL AND array_length(r.kws, 1) > 0 AND v_caption IS NOT NULL THEN
      v_kw_ok := true;
      FOREACH kw IN ARRAY r.kws LOOP
        IF NOT (
          lower(v_caption) LIKE '%' || lower(kw) || '%'
          OR word_similarity(lower(kw), lower(v_caption)) > 0.6
        ) THEN
          v_kw_ok := false;
          EXIT;
        END IF;
      END LOOP;
      IF v_kw_ok THEN
        v_method := 'caption_keywords';
        v_conf   := 0.7;
      END IF;
    END IF;

    IF v_method IS NOT NULL THEN
      INSERT INTO public.video_brief_matches (video_id, brief_id, match_method, confidence)
      VALUES (p_video_id, r.id, v_method, v_conf)
      ON CONFLICT (video_id, brief_id) DO NOTHING;

      IF FOUND THEN
        v_match_count := v_match_count + 1;
        -- Format propagation: only if content_tag is still null. Manual wins.
        IF v_content_tag IS NULL AND r.format_id IS NOT NULL THEN
          SELECT name INTO v_format_name FROM public.video_formats WHERE id = r.format_id;
          IF v_format_name IS NOT NULL THEN
            UPDATE public.videos
              SET content_tag = v_format_name
              WHERE id = p_video_id AND content_tag IS NULL;
            v_content_tag := v_format_name;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_video_to_briefs(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_match_video_to_briefs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.match_video_to_briefs(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS videos_match_briefs_ins ON public.videos;
CREATE TRIGGER videos_match_briefs_ins
  AFTER INSERT ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_match_video_to_briefs();

DROP TRIGGER IF EXISTS videos_match_briefs_upd ON public.videos;
CREATE TRIGGER videos_match_briefs_upd
  AFTER UPDATE OF audio_id, caption, hashtags ON public.videos
  FOR EACH ROW
  WHEN (
    NEW.audio_id IS DISTINCT FROM OLD.audio_id
    OR NEW.caption IS DISTINCT FROM OLD.caption
    OR NEW.hashtags IS DISTINCT FROM OLD.hashtags
  )
  EXECUTE FUNCTION public.trg_match_video_to_briefs();

-- Backfill helper
CREATE OR REPLACE FUNCTION public.rematch_all_unmatched_videos(p_days_back int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  r record;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR r IN
    SELECT v.id
    FROM public.videos v
    WHERE v.published_at >= now() - (p_days_back || ' days')::interval
      AND NOT EXISTS (SELECT 1 FROM public.video_brief_matches m WHERE m.video_id = v.id)
  LOOP
    v_total := v_total + public.match_video_to_briefs(r.id);
  END LOOP;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rematch_all_unmatched_videos(int) TO authenticated;

-- ---------------------------------------------------------------------
-- v_brief_stats: per-brief aggregated match performance.
-- Used only inside SECURITY DEFINER RPCs (no direct grant).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_brief_stats AS
SELECT
  b.id          AS brief_id,
  b.campaign_id AS campaign_id,
  b.format_id   AS format_id,
  COUNT(m.video_id)::int                              AS matched_videos_count,
  COALESCE(SUM(eff.effective_views), 0)::bigint       AS total_effective_views,
  COALESCE(SUM(eff.engagements), 0)::bigint           AS total_engagements,
  COALESCE(AVG(eff.engagement_pct), 0)::numeric       AS avg_engagement_pct,
  COALESCE(b.threshold_views_override, c.brief_threshold_views, 50000)::bigint        AS threshold_views,
  COALESCE(b.threshold_engagement_override, c.brief_threshold_engagement, 5.0)::numeric AS threshold_engagement
FROM public.video_briefs b
JOIN public.campaigns c ON c.id = b.campaign_id
LEFT JOIN public.video_brief_matches m ON m.brief_id = b.id
LEFT JOIN LATERAL (
  SELECT
    LEAST(
      CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0)
           ELSE COALESCE(v.views, 0) END,
      COALESCE(c.video_views_cap, 2147483647)
    ) AS effective_views,
    (COALESCE(v.likes, 0) + COALESCE(v.comments, 0)) AS engagements,
    CASE WHEN COALESCE(v.views, 0) = 0 THEN 0
         ELSE ((COALESCE(v.likes,0) + COALESCE(v.comments,0))::numeric / v.views) * 100 END AS engagement_pct
  FROM public.videos v
  WHERE v.id = m.video_id
) eff ON true
GROUP BY b.id, b.campaign_id, b.format_id,
         b.threshold_views_override, b.threshold_engagement_override,
         c.brief_threshold_views, c.brief_threshold_engagement;

-- ---------------------------------------------------------------------
-- RPC: get_content_calendar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_content_calendar(p_campaign_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result   jsonb;
  v_defaults jsonb;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'threshold_views',      COALESCE(c.brief_threshold_views, 50000),
    'threshold_engagement', COALESCE(c.brief_threshold_engagement, 5.0)
  ) INTO v_defaults
  FROM public.campaigns c WHERE c.id = p_campaign_id;

  WITH brief_data AS (
    SELECT
      b.*,
      to_char(date_trunc('week', b.planned_publish_date)::date, 'YYYY-MM-DD') AS week_start,
      vf.name AS format_name,
      s.matched_videos_count, s.total_effective_views, s.total_engagements,
      s.avg_engagement_pct, s.threshold_views, s.threshold_engagement,
      (s.total_effective_views >= s.threshold_views OR s.avg_engagement_pct >= s.threshold_engagement) AS is_winner
    FROM public.video_briefs b
    LEFT JOIN public.video_formats vf ON vf.id = b.format_id
    LEFT JOIN public.v_brief_stats s  ON s.brief_id = b.id
    WHERE b.campaign_id = p_campaign_id
      AND b.planned_publish_date BETWEEN p_from AND p_to
  ),
  brief_json AS (
    SELECT
      bd.week_start,
      bd.planned_publish_date,
      jsonb_build_object(
        'id', bd.id,
        'campaign_id', bd.campaign_id,
        'title', bd.title,
        'planned_publish_date', bd.planned_publish_date,
        'week_label', bd.week_label,
        'status', bd.status,
        'reference_type', bd.reference_type,
        'reference_links', bd.reference_links,
        'format_id', bd.format_id,
        'format_name', bd.format_name,
        'topic_ids', COALESCE((SELECT jsonb_agg(bt.topic_id) FROM public.brief_topics bt WHERE bt.brief_id = bd.id), '[]'::jsonb),
        'topic_names', COALESCE((SELECT jsonb_agg(ct.name ORDER BY ct.name) FROM public.brief_topics bt JOIN public.content_topics ct ON ct.id = bt.topic_id WHERE bt.brief_id = bd.id), '[]'::jsonb),
        'copy_text', bd.copy_text,
        'caption', bd.caption,
        'hashtags', COALESCE(to_jsonb(bd.hashtags), '[]'::jsonb),
        'visual_note', bd.visual_note,
        'audio_id', bd.audio_id,
        'expected_caption_keywords', COALESCE(to_jsonb(bd.expected_caption_keywords), '[]'::jsonb),
        'threshold_views_override', bd.threshold_views_override,
        'threshold_engagement_override', bd.threshold_engagement_override,
        'threshold_views', bd.threshold_views,
        'threshold_engagement', bd.threshold_engagement,
        'matched_videos_count', COALESCE(bd.matched_videos_count, 0),
        'total_effective_views', COALESCE(bd.total_effective_views, 0),
        'total_engagements', COALESCE(bd.total_engagements, 0),
        'avg_engagement_pct', ROUND(COALESCE(bd.avg_engagement_pct, 0), 2),
        'is_winner', COALESCE(bd.is_winner, false),
        'top_matched_video', (
          SELECT jsonb_build_object(
            'tiktok_url', 'https://www.tiktok.com/@' || COALESCE(ta.username,'') || '/video/' || v.tiktok_video_id,
            'account_username', ta.username,
            'effective_views', LEAST(
              CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END,
              COALESCE(cc.video_views_cap, 2147483647))
          )
          FROM public.video_brief_matches m
          JOIN public.videos v ON v.id = m.video_id
          JOIN public.tiktok_accounts ta ON ta.id = v.tiktok_account_id
          JOIN public.campaigns cc ON cc.id = bd.campaign_id
          WHERE m.brief_id = bd.id
          ORDER BY (CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END) DESC
          LIMIT 1
        ),
        'comments_count_open', COALESCE((SELECT COUNT(*) FROM public.brief_comments bcx WHERE bcx.brief_id = bd.id AND bcx.resolved = false), 0),
        'change_requests_count_pending', COALESCE((SELECT COUNT(*) FROM public.brief_change_requests crx WHERE crx.brief_id = bd.id AND crx.status = 'pending'), 0)
      ) AS brief_obj
    FROM brief_data bd
  ),
  weeks AS (
    SELECT week_start, jsonb_agg(brief_obj ORDER BY planned_publish_date) AS briefs
    FROM brief_json
    GROUP BY week_start
  )
  SELECT jsonb_build_object(
    'campaign_defaults', COALESCE(v_defaults, jsonb_build_object('threshold_views', 50000, 'threshold_engagement', 5.0)),
    'weeks', COALESCE((SELECT jsonb_agg(jsonb_build_object('week_start', week_start, 'briefs', briefs) ORDER BY week_start) FROM weeks), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_content_calendar(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------
-- RPC: get_content_analytics (wraps get_campaign_manager_data + breakdowns)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_content_analytics(
  p_period text DEFAULT '30d',
  p_campaign_id uuid DEFAULT NULL,
  p_format_id uuid DEFAULT NULL,
  p_topic_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base    jsonb;
  v_days    int;
  v_from    date;
  v_briefs  int;
  v_winners int;
  v_format  jsonb;
  v_topic   jsonb;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_base := public.get_campaign_manager_data(p_period);
  v_days := CASE p_period WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_from := (now() - (v_days || ' days')::interval)::date;

  SELECT COUNT(*)::int,
         COUNT(*) FILTER (WHERE s.total_effective_views >= s.threshold_views OR s.avg_engagement_pct >= s.threshold_engagement)::int
    INTO v_briefs, v_winners
  FROM public.video_briefs b
  JOIN public.v_brief_stats s ON s.brief_id = b.id
  WHERE b.planned_publish_date >= v_from
    AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
    AND (p_format_id IS NULL OR b.format_id = p_format_id)
    AND (p_topic_id IS NULL OR EXISTS (SELECT 1 FROM public.brief_topics bt WHERE bt.brief_id = b.id AND bt.topic_id = p_topic_id));

  SELECT COALESCE(jsonb_agg(x ORDER BY tv DESC), '[]'::jsonb) INTO v_format FROM (
    SELECT
      COALESCE(SUM(s.total_effective_views),0) AS tv,
      jsonb_build_object(
        'format_id', vf.id, 'format_name', vf.name,
        'brief_count', COUNT(b.id),
        'video_count', COALESCE(SUM(s.matched_videos_count),0),
        'total_views', COALESCE(SUM(s.total_effective_views),0),
        'avg_engagement_pct', ROUND(COALESCE(AVG(NULLIF(s.avg_engagement_pct,0)),0),2),
        'winner_count', COUNT(*) FILTER (WHERE s.total_effective_views >= s.threshold_views OR s.avg_engagement_pct >= s.threshold_engagement)
      ) AS x
    FROM public.video_briefs b
    JOIN public.video_formats vf ON vf.id = b.format_id
    JOIN public.v_brief_stats s ON s.brief_id = b.id
    WHERE b.planned_publish_date >= v_from
      AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
      AND (p_format_id IS NULL OR b.format_id = p_format_id)
      AND (p_topic_id IS NULL OR EXISTS (SELECT 1 FROM public.brief_topics bt WHERE bt.brief_id = b.id AND bt.topic_id = p_topic_id))
    GROUP BY vf.id, vf.name
  ) q;

  SELECT COALESCE(jsonb_agg(x ORDER BY tv DESC), '[]'::jsonb) INTO v_topic FROM (
    SELECT
      COALESCE(SUM(s.total_effective_views),0) AS tv,
      jsonb_build_object(
        'topic_id', ct.id, 'topic_name', ct.name,
        'brief_count', COUNT(DISTINCT b.id),
        'video_count', COALESCE(SUM(s.matched_videos_count),0),
        'total_views', COALESCE(SUM(s.total_effective_views),0),
        'avg_engagement_pct', ROUND(COALESCE(AVG(NULLIF(s.avg_engagement_pct,0)),0),2),
        'winner_count', COUNT(*) FILTER (WHERE s.total_effective_views >= s.threshold_views OR s.avg_engagement_pct >= s.threshold_engagement)
      ) AS x
    FROM public.brief_topics bt2
    JOIN public.content_topics ct ON ct.id = bt2.topic_id
    JOIN public.video_briefs b ON b.id = bt2.brief_id
    JOIN public.v_brief_stats s ON s.brief_id = b.id
    WHERE b.planned_publish_date >= v_from
      AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
      AND (p_format_id IS NULL OR b.format_id = p_format_id)
      AND (p_topic_id IS NULL OR bt2.topic_id = p_topic_id)
    GROUP BY ct.id, ct.name
  ) q;

  RETURN v_base || jsonb_build_object(
    'briefs_count_in_period', v_briefs,
    'briefs_winner_count', v_winners,
    'format_breakdown', v_format,
    'topic_breakdown', v_topic
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_content_analytics(text, uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- RPC: get_content_insights
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_content_insights(p_period text DEFAULT '30d', p_campaign_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int;
  v_cur_from date;
  v_prev_from date;
  v_prev_to date;
  v_top_formats jsonb;
  v_cross jsonb;
  v_winners jsonb;
  v_losers jsonb;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'team'::app_role)
    OR public.has_role(auth.uid(),'campaign_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_days := CASE p_period WHEN '7d' THEN 7 WHEN '90d' THEN 90 ELSE 30 END;
  v_cur_from  := (now() - (v_days || ' days')::interval)::date;
  v_prev_from := (now() - ((2 * v_days) || ' days')::interval)::date;
  v_prev_to   := v_cur_from;

  -- top_formats_week
  WITH cur AS (
    SELECT vf.id AS fid, vf.name AS fname,
      COUNT(b.id) AS brief_count,
      COALESCE(SUM(s.matched_videos_count),0) AS video_count,
      COALESCE(SUM(s.total_effective_views),0) AS total_views,
      ROUND(COALESCE(AVG(NULLIF(s.avg_engagement_pct,0)),0),2) AS avg_eng
    FROM public.video_briefs b
    JOIN public.video_formats vf ON vf.id = b.format_id
    JOIN public.v_brief_stats s ON s.brief_id = b.id
    WHERE b.planned_publish_date >= v_cur_from
      AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
      AND EXISTS (SELECT 1 FROM public.video_brief_matches m WHERE m.brief_id = b.id)
    GROUP BY vf.id, vf.name
  ),
  prev AS (
    SELECT vf.id AS fid,
      COALESCE(SUM(s.total_effective_views),0) AS total_views,
      ROUND(COALESCE(AVG(NULLIF(s.avg_engagement_pct,0)),0),2) AS avg_eng
    FROM public.video_briefs b
    JOIN public.video_formats vf ON vf.id = b.format_id
    JOIN public.v_brief_stats s ON s.brief_id = b.id
    WHERE b.planned_publish_date >= v_prev_from AND b.planned_publish_date < v_prev_to
      AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
    GROUP BY vf.id
  )
  SELECT COALESCE(jsonb_agg(obj ORDER BY tv DESC), '[]'::jsonb) INTO v_top_formats FROM (
    SELECT cur.total_views AS tv, jsonb_build_object(
      'format_id', cur.fid, 'name', cur.fname,
      'brief_count', cur.brief_count, 'video_count', cur.video_count,
      'total_views', cur.total_views, 'avg_engagement_pct', cur.avg_eng,
      'delta_views_pct', CASE WHEN COALESCE(prev.total_views,0) = 0 THEN NULL
        ELSE ROUND(((cur.total_views - prev.total_views)::numeric / prev.total_views) * 100, 1) END,
      'delta_engagement_pct', CASE WHEN COALESCE(prev.avg_eng,0) = 0 THEN NULL
        ELSE ROUND(((cur.avg_eng - prev.avg_eng) / prev.avg_eng) * 100, 1) END
    ) AS obj
    FROM cur LEFT JOIN prev ON prev.fid = cur.fid
    ORDER BY cur.total_views DESC
    LIMIT 5
  ) z;

  -- cross_creator_same_brief
  WITH bm AS (
    SELECT m.brief_id, ta.creator_id, cr.name AS creator_name,
      LEAST(CASE WHEN v.window_closed THEN COALESCE(v.views_final,v.views,0) ELSE COALESCE(v.views,0) END,
            COALESCE(c.video_views_cap, 2147483647)) AS eff,
      CASE WHEN COALESCE(v.views,0)=0 THEN 0 ELSE ((COALESCE(v.likes,0)+COALESCE(v.comments,0))::numeric/v.views)*100 END AS eng
    FROM public.video_brief_matches m
    JOIN public.videos v ON v.id = m.video_id
    JOIN public.tiktok_accounts ta ON ta.id = v.tiktok_account_id
    JOIN public.campaigns c ON c.id = ta.campaign_id
    LEFT JOIN public.creators cr ON cr.id = ta.creator_id
    JOIN public.video_briefs b ON b.id = m.brief_id
    WHERE b.planned_publish_date >= v_cur_from
      AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
      AND ta.creator_id IS NOT NULL
  ),
  per_creator AS (
    SELECT brief_id, creator_id, MAX(creator_name) AS creator_name,
      COUNT(*) AS video_count, SUM(eff) AS total_views, AVG(eng) AS avg_eng
    FROM bm GROUP BY brief_id, creator_id
  ),
  brief_cc AS (
    SELECT pc.brief_id,
      MAX(pc.total_views) AS top_v, MIN(pc.total_views) AS bot_v
    FROM per_creator pc GROUP BY pc.brief_id HAVING COUNT(*) >= 2
  )
  SELECT COALESCE(jsonb_agg(obj ORDER BY uplift DESC NULLS LAST), '[]'::jsonb) INTO v_cross FROM (
    SELECT
      CASE WHEN bc.bot_v = 0 THEN NULL ELSE ((bc.top_v - bc.bot_v)::numeric / bc.bot_v) * 100 END AS uplift,
      jsonb_build_object(
        'brief_id', bc.brief_id,
        'brief_title', b.title,
        'format_name', vf.name,
        'uplift_pct', CASE WHEN bc.bot_v = 0 THEN NULL ELSE ROUND(((bc.top_v - bc.bot_v)::numeric / bc.bot_v) * 100, 1) END,
        'creators', (
          SELECT jsonb_agg(jsonb_build_object(
            'creator_id', pc.creator_id, 'creator_name', pc.creator_name,
            'video_count', pc.video_count, 'total_views', pc.total_views,
            'avg_engagement_pct', ROUND(COALESCE(pc.avg_eng,0),2)
          ) ORDER BY pc.total_views DESC)
          FROM per_creator pc WHERE pc.brief_id = bc.brief_id
        )
      ) AS obj
    FROM brief_cc bc
    JOIN public.video_briefs b ON b.id = bc.brief_id
    LEFT JOIN public.video_formats vf ON vf.id = b.format_id
    ORDER BY uplift DESC NULLS LAST
    LIMIT 10
  ) z;

  -- winners
  SELECT COALESCE(jsonb_agg(obj ORDER BY tv DESC), '[]'::jsonb) INTO v_winners FROM (
    SELECT s.total_effective_views AS tv, jsonb_build_object(
      'brief_id', b.id, 'title', b.title, 'format_name', vf.name,
      'format_id', b.format_id,
      'total_views', s.total_effective_views, 'avg_engagement_pct', ROUND(s.avg_engagement_pct,2),
      'threshold_views', s.threshold_views, 'threshold_engagement', s.threshold_engagement
    ) AS obj
    FROM public.video_briefs b
    JOIN public.v_brief_stats s ON s.brief_id = b.id
    LEFT JOIN public.video_formats vf ON vf.id = b.format_id
    WHERE b.planned_publish_date >= v_cur_from
      AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
      AND (s.total_effective_views >= s.threshold_views OR s.avg_engagement_pct >= s.threshold_engagement)
    ORDER BY s.total_effective_views DESC
    LIMIT 10
  ) z;

  -- losers
  SELECT COALESCE(jsonb_agg(obj ORDER BY tv ASC), '[]'::jsonb) INTO v_losers FROM (
    SELECT s.total_effective_views AS tv, jsonb_build_object(
      'brief_id', b.id, 'title', b.title, 'format_name', vf.name,
      'format_id', b.format_id,
      'total_views', s.total_effective_views, 'avg_engagement_pct', ROUND(s.avg_engagement_pct,2),
      'threshold_views', s.threshold_views, 'threshold_engagement', s.threshold_engagement
    ) AS obj
    FROM public.video_briefs b
    JOIN public.v_brief_stats s ON s.brief_id = b.id
    LEFT JOIN public.video_formats vf ON vf.id = b.format_id
    WHERE b.planned_publish_date >= v_cur_from
      AND (p_campaign_id IS NULL OR b.campaign_id = p_campaign_id)
      AND (
        b.status = 'archived'
        OR (s.matched_videos_count >= 2
            AND s.total_effective_views < s.threshold_views * 0.5
            AND s.avg_engagement_pct < s.threshold_engagement * 0.5)
      )
    ORDER BY s.total_effective_views ASC
    LIMIT 10
  ) z;

  RETURN jsonb_build_object(
    'top_formats_week', v_top_formats,
    'cross_creator_same_brief', v_cross,
    'winners_and_losers', jsonb_build_object('winners', v_winners, 'losers', v_losers)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_content_insights(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- RPC: notify_brief_event (centralised recipient resolution)
-- targets: any of 'creators','clients','staff'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_brief_event(
  p_brief_id uuid,
  p_type text,
  p_message text,
  p_link text DEFAULT NULL,
  p_targets text[] DEFAULT ARRAY['creators','clients','staff']
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_client uuid;
  v_actor uuid := auth.uid();
  v_total int := 0;
  v_n int;
  v_meta jsonb;
BEGIN
  IF v_actor IS NULL THEN RETURN 0; END IF;

  SELECT campaign_id INTO v_campaign_id FROM public.video_briefs WHERE id = p_brief_id;
  IF v_campaign_id IS NULL THEN RETURN 0; END IF;

  v_meta := jsonb_build_object('ref', p_brief_id::text);

  IF 'clients' = ANY(p_targets) THEN
    SELECT client_profile_id INTO v_client FROM public.campaigns WHERE id = v_campaign_id;
    IF v_client IS NOT NULL AND v_client <> v_actor THEN
      INSERT INTO public.notifications (user_id, campaign_id, type, message, link, severity, meta)
      VALUES (v_client, v_campaign_id, p_type, p_message, p_link, 'info', v_meta);
      v_total := v_total + 1;
    END IF;
  END IF;

  IF 'creators' = ANY(p_targets) THEN
    INSERT INTO public.notifications (user_id, campaign_id, type, message, link, severity, meta)
    SELECT DISTINCT cr.profile_id, v_campaign_id, p_type, p_message, p_link, 'info', v_meta
    FROM public.campaign_creators cc
    JOIN public.creators cr ON cr.id = cc.creator_id
    WHERE cc.campaign_id = v_campaign_id
      AND cr.profile_id IS NOT NULL
      AND cr.profile_id <> v_actor;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
  END IF;

  IF 'staff' = ANY(p_targets) THEN
    INSERT INTO public.notifications (user_id, campaign_id, type, message, link, severity, meta)
    SELECT DISTINCT ur.user_id, v_campaign_id, p_type, p_message, p_link, 'info', v_meta
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'team'::app_role, 'campaign_manager'::app_role)
      AND ur.user_id <> v_actor;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
  END IF;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_brief_event(uuid, text, text, text, text[]) TO authenticated;

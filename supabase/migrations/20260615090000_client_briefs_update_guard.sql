-- Block client from modifying any brief column except 'status' and 'updated_at'.
-- Postgres has no column-level UPDATE RLS; we enforce it with a BEFORE UPDATE trigger.

CREATE OR REPLACE FUNCTION public.guard_client_brief_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only apply to client role. Staff (admin/team/campaign_manager) can update freely.
  IF NOT public.has_role(auth.uid(), 'client'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Status transitions allowed for client: in_review <-> approved.
  -- Reject anything else (e.g. archived, draft).
  IF NEW.status NOT IN ('in_review','approved') THEN
    RAISE EXCEPTION 'Client cannot set brief status to %', NEW.status
      USING ERRCODE = '42501';
  END IF;

  -- Client may only change status and updated_at. Reject any other column change.
  IF (NEW.campaign_id            IS DISTINCT FROM OLD.campaign_id)
  OR (NEW.planned_publish_date   IS DISTINCT FROM OLD.planned_publish_date)
  OR (NEW.week_label             IS DISTINCT FROM OLD.week_label)
  OR (NEW.reference_type         IS DISTINCT FROM OLD.reference_type)
  OR (NEW.reference_links::text  IS DISTINCT FROM OLD.reference_links::text)
  OR (NEW.audio_id               IS DISTINCT FROM OLD.audio_id)
  OR (NEW.expected_caption_keywords IS DISTINCT FROM OLD.expected_caption_keywords)
  OR (NEW.format_id              IS DISTINCT FROM OLD.format_id)
  OR (NEW.title                  IS DISTINCT FROM OLD.title)
  OR (NEW.copy_text              IS DISTINCT FROM OLD.copy_text)
  OR (NEW.caption                IS DISTINCT FROM OLD.caption)
  OR (NEW.hashtags               IS DISTINCT FROM OLD.hashtags)
  OR (NEW.visual_note            IS DISTINCT FROM OLD.visual_note)
  OR (NEW.threshold_views_override      IS DISTINCT FROM OLD.threshold_views_override)
  OR (NEW.threshold_engagement_override IS DISTINCT FROM OLD.threshold_engagement_override)
  OR (NEW.created_by             IS DISTINCT FROM OLD.created_by)
  OR (NEW.created_at             IS DISTINCT FROM OLD.created_at)
  THEN
    RAISE EXCEPTION 'Client can only change brief status, not other fields. Use a change_request instead.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_client_brief_updates ON public.video_briefs;
CREATE TRIGGER guard_client_brief_updates
  BEFORE UPDATE ON public.video_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_client_brief_updates();

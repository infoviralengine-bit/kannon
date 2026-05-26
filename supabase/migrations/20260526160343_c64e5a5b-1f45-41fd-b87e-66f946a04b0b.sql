
-- Add columns to notifications for richer alerts
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type_ref
  ON public.notifications (type, ((meta->>'ref')));

-- Enable realtime for live updates
ALTER TABLE public.videos REPLICA IDENTITY FULL;
ALTER TABLE public.scraping_logs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'videos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scraping_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_logs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Helper RPC: returns last successful scrape timestamp (only for admin/team/campaign_manager)
CREATE OR REPLACE FUNCTION public.get_last_scrape_at()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'team'::app_role) OR
    has_role(auth.uid(), 'campaign_manager'::app_role)
  ) THEN
    RETURN NULL;
  END IF;
  SELECT MAX(run_at) INTO v_at FROM scraping_logs WHERE status = 'success';
  RETURN v_at;
END $$;

GRANT EXECUTE ON FUNCTION public.get_last_scrape_at() TO authenticated;

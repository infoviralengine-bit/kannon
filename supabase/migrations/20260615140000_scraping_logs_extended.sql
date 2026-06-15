-- SP#5 Part A: resilient scraping. Extend scraping_logs for background polling status sync.

ALTER TABLE public.scraping_logs
  ADD COLUMN IF NOT EXISTS run_id text NULL,
  ADD COLUMN IF NOT EXISTS dataset_id text NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS progress_note text NULL,
  ADD COLUMN IF NOT EXISTS triggered_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scraping_logs_status_run_at
  ON public.scraping_logs(status, run_at DESC);

-- Normalize existing statuses before applying the CHECK.
UPDATE public.scraping_logs SET status = 'success' WHERE status NOT IN ('running','success','error');

ALTER TABLE public.scraping_logs DROP CONSTRAINT IF EXISTS scraping_logs_status_check;
ALTER TABLE public.scraping_logs
  ADD CONSTRAINT scraping_logs_status_check
  CHECK (status IN ('running','success','error'));

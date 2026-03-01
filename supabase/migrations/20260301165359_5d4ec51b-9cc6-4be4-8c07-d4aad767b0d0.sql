
-- Add last_scraped_at to tiktok_accounts
ALTER TABLE public.tiktok_accounts ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;

-- Create scraping_logs table
CREATE TABLE IF NOT EXISTS public.scraping_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  accounts_processed integer NOT NULL DEFAULT 0,
  videos_updated integer NOT NULL DEFAULT 0,
  videos_created integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scraping_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage scraping_logs"
  ON public.scraping_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));


-- Add warmup columns to tiktok_accounts
ALTER TABLE public.tiktok_accounts 
  ADD COLUMN IF NOT EXISTS warmup_day integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

-- Create creator_content table
CREATE TABLE public.creator_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'brief',
  body text,
  file_url text,
  due_date date,
  status text NOT NULL DEFAULT 'assegnato',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own content" ON public.creator_content
  FOR SELECT TO authenticated
  USING (creator_id IN (SELECT id FROM creators WHERE profile_id = auth.uid()));

CREATE POLICY "Admin team can manage content" ON public.creator_content
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));

CREATE POLICY "Creators can update own content status" ON public.creator_content
  FOR UPDATE TO authenticated
  USING (creator_id IN (SELECT id FROM creators WHERE profile_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM creators WHERE profile_id = auth.uid()));

-- Create creator_calendar table
CREATE TABLE public.creator_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  tiktok_account_id uuid REFERENCES public.tiktok_accounts(id) ON DELETE SET NULL,
  scheduled_for date NOT NULL,
  content_id uuid REFERENCES public.creator_content(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'programmato',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own calendar" ON public.creator_calendar
  FOR SELECT TO authenticated
  USING (creator_id IN (SELECT id FROM creators WHERE profile_id = auth.uid()));

CREATE POLICY "Admin team can manage calendar" ON public.creator_calendar
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));


-- Closer leads table
CREATE TABLE public.closer_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  tiktok_username text,
  call_datetime timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closer_leads ENABLE ROW LEVEL SECURITY;

-- Closer + admin + team can view all leads
CREATE POLICY "Closer admin team can view leads" ON public.closer_leads
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

-- Closer + admin can update leads (set outcome)
CREATE POLICY "Closer admin can update leads" ON public.closer_leads
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Outreach + admin + team can insert leads
CREATE POLICY "Outreach admin team can insert leads" ON public.closer_leads
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

-- Admin can delete leads
CREATE POLICY "Admin can delete leads" ON public.closer_leads
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Onboarding links table
CREATE TABLE public.onboarding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.closer_leads(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  contract_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.onboarding_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Closer admin can manage onboarding_links" ON public.onboarding_links
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Public read for onboarding page (by token)
CREATE POLICY "Public can view onboarding by token" ON public.onboarding_links
FOR SELECT TO anon
USING (true);

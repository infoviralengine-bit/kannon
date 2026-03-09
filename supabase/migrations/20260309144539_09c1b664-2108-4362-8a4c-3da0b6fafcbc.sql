
-- Create outreach_templates table
CREATE TABLE public.outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;

-- Admin can fully manage templates
CREATE POLICY "Admin can manage outreach_templates"
  ON public.outreach_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Outreach/team can view active templates
CREATE POLICY "Outreach and team can view active templates"
  ON public.outreach_templates FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      has_role(auth.uid(), 'outreach') OR has_role(auth.uid(), 'team')
    )
  );

-- Add owner_profile_id to tiktok_accounts
ALTER TABLE public.tiktok_accounts
  ADD COLUMN owner_profile_id uuid REFERENCES public.profiles(id);

-- Add template_id to outreach_stats
ALTER TABLE public.outreach_stats
  ADD COLUMN template_id uuid REFERENCES public.outreach_templates(id);

-- RLS: Outreach can view own tiktok_accounts
CREATE POLICY "Outreach can view own accounts"
  ON public.tiktok_accounts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'outreach') AND owner_profile_id = auth.uid());

CREATE POLICY "Outreach can insert own accounts"
  ON public.tiktok_accounts FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'outreach')
    AND owner_profile_id = auth.uid()
    AND account_type = 'Outreach'
  );

CREATE POLICY "Outreach can update own accounts"
  ON public.tiktok_accounts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'outreach') AND owner_profile_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'outreach') AND owner_profile_id = auth.uid());

-- RLS: Outreach can insert/view own stats
CREATE POLICY "Outreach can insert own stats"
  ON public.outreach_stats FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'outreach')
    AND tiktok_account_id IN (
      SELECT id FROM public.tiktok_accounts WHERE owner_profile_id = auth.uid()
    )
  );

CREATE POLICY "Outreach can view own stats"
  ON public.outreach_stats FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'outreach')
    AND tiktok_account_id IN (
      SELECT id FROM public.tiktok_accounts WHERE owner_profile_id = auth.uid()
    )
  );

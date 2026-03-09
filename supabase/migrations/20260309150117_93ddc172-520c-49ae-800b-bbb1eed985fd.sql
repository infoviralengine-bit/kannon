
-- Drop all restrictive outreach policies on tiktok_accounts
DROP POLICY IF EXISTS "Outreach can insert own accounts" ON public.tiktok_accounts;
DROP POLICY IF EXISTS "Outreach can update own accounts" ON public.tiktok_accounts;
DROP POLICY IF EXISTS "Outreach can view own accounts" ON public.tiktok_accounts;

-- Recreate as PERMISSIVE
CREATE POLICY "Outreach can view own accounts"
ON public.tiktok_accounts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid());

CREATE POLICY "Outreach can insert own accounts"
ON public.tiktok_accounts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid() AND account_type = 'Outreach'::text);

CREATE POLICY "Outreach can update own accounts"
ON public.tiktok_accounts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid());

-- Same fix for outreach_stats
DROP POLICY IF EXISTS "Outreach can view own stats" ON public.outreach_stats;
DROP POLICY IF EXISTS "Outreach can insert own stats" ON public.outreach_stats;

CREATE POLICY "Outreach can view own stats"
ON public.outreach_stats FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND tiktok_account_id IN (
  SELECT id FROM tiktok_accounts WHERE owner_profile_id = auth.uid()
));

CREATE POLICY "Outreach can insert own stats"
ON public.outreach_stats FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND tiktok_account_id IN (
  SELECT id FROM tiktok_accounts WHERE owner_profile_id = auth.uid()
));

-- Fix outreach_templates - outreach needs to READ active templates
DROP POLICY IF EXISTS "Outreach and team can view active templates" ON public.outreach_templates;

CREATE POLICY "Outreach and team can view active templates"
ON public.outreach_templates FOR SELECT TO authenticated
USING (is_active = true AND (has_role(auth.uid(), 'outreach'::app_role) OR has_role(auth.uid(), 'team'::app_role)));


-- Drop all existing policies on tiktok_accounts and recreate as PERMISSIVE

DROP POLICY IF EXISTS "Admin and team can manage tiktok_accounts" ON public.tiktok_accounts;
DROP POLICY IF EXISTS "Creators can view own tiktok_accounts" ON public.tiktok_accounts;
DROP POLICY IF EXISTS "Outreach can insert own accounts" ON public.tiktok_accounts;
DROP POLICY IF EXISTS "Outreach can update own accounts" ON public.tiktok_accounts;
DROP POLICY IF EXISTS "Outreach can view own accounts" ON public.tiktok_accounts;

-- Recreate as PERMISSIVE
CREATE POLICY "Admin and team can manage tiktok_accounts"
ON public.tiktok_accounts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Creators can view own tiktok_accounts"
ON public.tiktok_accounts FOR SELECT TO authenticated
USING (creator_id IN (SELECT id FROM creators WHERE profile_id = auth.uid()));

CREATE POLICY "Outreach can view own accounts"
ON public.tiktok_accounts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid());

CREATE POLICY "Outreach can insert own accounts"
ON public.tiktok_accounts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid() AND account_type = 'outreach'::text);

CREATE POLICY "Outreach can update own accounts"
ON public.tiktok_accounts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid());

-- Same fix for outreach_stats
DROP POLICY IF EXISTS "Admin and team can manage outreach_stats" ON public.outreach_stats;
DROP POLICY IF EXISTS "Outreach can insert own stats" ON public.outreach_stats;
DROP POLICY IF EXISTS "Outreach can view own stats" ON public.outreach_stats;

CREATE POLICY "Admin and team can manage outreach_stats"
ON public.outreach_stats FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Outreach can view own stats"
ON public.outreach_stats FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND tiktok_account_id IN (SELECT id FROM tiktok_accounts WHERE owner_profile_id = auth.uid()));

CREATE POLICY "Outreach can insert own stats"
ON public.outreach_stats FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND tiktok_account_id IN (SELECT id FROM tiktok_accounts WHERE owner_profile_id = auth.uid()));

-- Same fix for outreach_templates
DROP POLICY IF EXISTS "Admin can manage outreach_templates" ON public.outreach_templates;
DROP POLICY IF EXISTS "Outreach and team can view active templates" ON public.outreach_templates;

CREATE POLICY "Admin can manage outreach_templates"
ON public.outreach_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Outreach and team can view active templates"
ON public.outreach_templates FOR SELECT TO authenticated
USING (is_active = true AND (has_role(auth.uid(), 'outreach'::app_role) OR has_role(auth.uid(), 'team'::app_role)));

-- Allow outreach users to delete their own stats
CREATE POLICY "Outreach can delete own stats"
ON public.outreach_stats FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND owns_tiktok_account(auth.uid(), tiktok_account_id));

-- Allow admin to delete templates
DROP POLICY IF EXISTS "Admin can manage outreach_templates" ON public.outreach_templates;
CREATE POLICY "Admin can manage outreach_templates"
ON public.outreach_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
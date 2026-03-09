
-- Allow outreach users to update their own stats (replies)
CREATE POLICY "Outreach can update own stats"
ON public.outreach_stats FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND tiktok_account_id IN (SELECT id FROM tiktok_accounts WHERE owner_profile_id = auth.uid()))
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND tiktok_account_id IN (SELECT id FROM tiktok_accounts WHERE owner_profile_id = auth.uid()));

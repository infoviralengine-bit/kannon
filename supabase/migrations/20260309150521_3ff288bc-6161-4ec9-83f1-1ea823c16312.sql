
-- Fix RLS policy to match lowercase 'outreach' account_type
DROP POLICY IF EXISTS "Outreach can insert own accounts" ON public.tiktok_accounts;
CREATE POLICY "Outreach can insert own accounts"
ON public.tiktok_accounts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND owner_profile_id = auth.uid() AND account_type = 'outreach'::text);

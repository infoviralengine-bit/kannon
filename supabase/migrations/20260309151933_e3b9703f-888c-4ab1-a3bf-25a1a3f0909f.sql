
-- Create a security definer function to check if user owns the tiktok account
CREATE OR REPLACE FUNCTION public.owns_tiktok_account(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tiktok_accounts
    WHERE id = _account_id AND owner_profile_id = _user_id
  )
$$;

-- Recreate outreach_stats policies using the function
DROP POLICY IF EXISTS "Outreach can view own stats" ON public.outreach_stats;
DROP POLICY IF EXISTS "Outreach can insert own stats" ON public.outreach_stats;
DROP POLICY IF EXISTS "Outreach can update own stats" ON public.outreach_stats;

CREATE POLICY "Outreach can view own stats"
ON public.outreach_stats FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND owns_tiktok_account(auth.uid(), tiktok_account_id));

CREATE POLICY "Outreach can insert own stats"
ON public.outreach_stats FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND owns_tiktok_account(auth.uid(), tiktok_account_id));

CREATE POLICY "Outreach can update own stats"
ON public.outreach_stats FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'outreach'::app_role) AND owns_tiktok_account(auth.uid(), tiktok_account_id))
WITH CHECK (has_role(auth.uid(), 'outreach'::app_role) AND owns_tiktok_account(auth.uid(), tiktok_account_id));

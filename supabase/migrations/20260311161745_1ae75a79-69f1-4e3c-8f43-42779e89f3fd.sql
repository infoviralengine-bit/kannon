
-- Fix: Change RESTRICTIVE anon policies to PERMISSIVE on onboarding_links
DROP POLICY IF EXISTS "Public can view onboarding by token" ON public.onboarding_links;
CREATE POLICY "Public can view onboarding by token"
  ON public.onboarding_links
  FOR SELECT
  TO anon
  USING (true);

-- Fix: Change RESTRICTIVE anon policies to PERMISSIVE on closer_leads
DROP POLICY IF EXISTS "Anon can read leads for onboarding join" ON public.closer_leads;
CREATE POLICY "Anon can read leads for onboarding join"
  ON public.closer_leads
  FOR SELECT
  TO anon
  USING (true);

-- Fix: Change RESTRICTIVE anon policies to PERMISSIVE on contracts
DROP POLICY IF EXISTS "Anon can read contracts for onboarding" ON public.contracts;
CREATE POLICY "Anon can read contracts for onboarding"
  ON public.contracts
  FOR SELECT
  TO anon
  USING (true);

-- Fix: Change RESTRICTIVE anon policies to PERMISSIVE on contract_campaigns
DROP POLICY IF EXISTS "Anon can read contract_campaigns for onboarding" ON public.contract_campaigns;
CREATE POLICY "Anon can read contract_campaigns for onboarding"
  ON public.contract_campaigns
  FOR SELECT
  TO anon
  USING (true);

-- Fix: Change RESTRICTIVE anon policies to PERMISSIVE on campaigns
DROP POLICY IF EXISTS "Anon can read campaigns for onboarding" ON public.campaigns;
CREATE POLICY "Anon can read campaigns for onboarding"
  ON public.campaigns
  FOR SELECT
  TO anon
  USING (true);

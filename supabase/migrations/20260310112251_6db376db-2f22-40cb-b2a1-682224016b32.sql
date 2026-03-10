-- Allow anon users to read contract_campaigns for onboarding
CREATE POLICY "Anon can read contract_campaigns for onboarding"
  ON public.contract_campaigns FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to read campaign names for onboarding
CREATE POLICY "Anon can read campaigns for onboarding"
  ON public.campaigns FOR SELECT
  TO anon
  USING (true);
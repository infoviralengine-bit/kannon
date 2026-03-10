-- Fix: onboarding_links anon policy should be PERMISSIVE
DROP POLICY IF EXISTS "Public can view onboarding by token" ON public.onboarding_links;
CREATE POLICY "Public can view onboarding by token"
  ON public.onboarding_links
  FOR SELECT
  TO anon
  USING (true);

-- Also need anon read on closer_leads for the join
CREATE POLICY "Anon can read leads for onboarding join"
  ON public.closer_leads
  FOR SELECT
  TO anon
  USING (true);
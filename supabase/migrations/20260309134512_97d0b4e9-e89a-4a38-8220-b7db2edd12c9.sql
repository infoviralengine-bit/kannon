-- Allow creators to view their own contract_creators rows
CREATE POLICY "Creators can view own contract_creators"
ON public.contract_creators
FOR SELECT
TO authenticated
USING (
  creator_id IN (
    SELECT id FROM public.creators WHERE profile_id = auth.uid()
  )
);

-- Allow creators to view contracts they belong to
CREATE POLICY "Creators can view own contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT contract_id FROM public.contract_creators
    WHERE creator_id IN (
      SELECT id FROM public.creators WHERE profile_id = auth.uid()
    )
  )
);

-- Allow creators to view contract_campaigns for their contracts
CREATE POLICY "Creators can view own contract_campaigns"
ON public.contract_campaigns
FOR SELECT
TO authenticated
USING (
  contract_id IN (
    SELECT contract_id FROM public.contract_creators
    WHERE creator_id IN (
      SELECT id FROM public.creators WHERE profile_id = auth.uid()
    )
  )
);
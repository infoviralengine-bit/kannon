
-- Add personal/payment fields to creators
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS fiscal_code text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS address_province text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS iban_holder_name text;

-- Add contract_text to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_text text NOT NULL DEFAULT '';

-- Add creator_id to onboarding_links
ALTER TABLE public.onboarding_links
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.creators(id);

-- Create contract_signatures table
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  onboarding_link_id uuid REFERENCES public.onboarding_links(id),
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Admin/team can manage signatures
CREATE POLICY "Admin team can manage signatures"
ON public.contract_signatures FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

-- Creators can view own signatures
CREATE POLICY "Creators can view own signatures"
ON public.contract_signatures FOR SELECT TO authenticated
USING (creator_id IN (SELECT c.id FROM creators c WHERE c.profile_id = auth.uid()));

-- Allow anon to read contracts (for onboarding page)
CREATE POLICY "Anon can read contracts for onboarding"
ON public.contracts FOR SELECT TO anon
USING (true);

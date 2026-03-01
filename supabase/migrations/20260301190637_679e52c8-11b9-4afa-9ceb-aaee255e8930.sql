
-- Contracts table
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  creator_fixed numeric NOT NULL DEFAULT 0,
  creator_cpm numeric NOT NULL DEFAULT 0.5,
  min_videos_per_day integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contract-Campaign mapping
CREATE TABLE public.contract_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  UNIQUE(contract_id, campaign_id)
);

-- Contract-Creator mapping
CREATE TABLE public.contract_creators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, creator_id)
);

-- RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage contracts" ON public.contracts
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));

CREATE POLICY "Admin and team can manage contract_campaigns" ON public.contract_campaigns
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));

CREATE POLICY "Admin and team can manage contract_creators" ON public.contract_creators
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));

-- Trigger: auto-create campaign_creators when a creator is added to a contract
CREATE OR REPLACE FUNCTION public.auto_link_contract_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO campaign_creators (campaign_id, creator_id)
  SELECT cc.campaign_id, NEW.creator_id
  FROM contract_campaigns cc
  WHERE cc.contract_id = NEW.contract_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_link_contract_creator
  AFTER INSERT ON public.contract_creators
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_contract_creator();

-- Trigger: auto-link existing contract creators when a campaign is added to a contract
CREATE OR REPLACE FUNCTION public.auto_link_contract_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO campaign_creators (campaign_id, creator_id)
  SELECT NEW.campaign_id, cc.creator_id
  FROM contract_creators cc
  WHERE cc.contract_id = NEW.contract_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_link_contract_campaign
  AFTER INSERT ON public.contract_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_contract_campaign();

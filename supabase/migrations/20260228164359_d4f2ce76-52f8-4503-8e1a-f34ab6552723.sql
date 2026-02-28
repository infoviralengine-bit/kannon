
-- Payment cycles for campaigns
CREATE TABLE public.payment_cycles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL,
  cycle_start_date date NOT NULL,
  cycle_end_date date NOT NULL,
  is_last_cycle boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and team can manage payment_cycles" ON public.payment_cycles AS RESTRICTIVE FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')
);

-- Client payments (receivable)
CREATE TABLE public.client_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.payment_cycles(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL,
  due_date date NOT NULL,
  fixed_amount numeric(10,2) NOT NULL DEFAULT 0,
  cpm_views integer NOT NULL DEFAULT 0,
  cpm_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  views_snapshot_at timestamptz,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and team can manage client_payments" ON public.client_payments AS RESTRICTIVE FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')
);

-- Creator payments (payable)
CREATE TABLE public.creator_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  fixed_amount numeric(10,2) NOT NULL DEFAULT 0,
  fixed_earned boolean NOT NULL DEFAULT false,
  cpm_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id, period_month, period_year)
);

ALTER TABLE public.creator_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and team can manage creator_payments" ON public.creator_payments AS RESTRICTIVE FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')
);
CREATE POLICY "Creators can view own creator_payments" ON public.creator_payments AS RESTRICTIVE FOR SELECT USING (
  creator_id IN (SELECT id FROM creators WHERE profile_id = auth.uid())
);

-- Add views_at_last_payment to videos
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS views_at_last_payment integer NOT NULL DEFAULT 0;

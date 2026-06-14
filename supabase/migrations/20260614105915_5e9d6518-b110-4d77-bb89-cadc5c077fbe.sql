
-- 1A · recurring_expenses
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL CHECK (category IN ('creator_pay','operator_pay','tool','software','rent','salary_fixed','other')),
  due_day smallint NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NULL,
  is_active boolean NOT NULL DEFAULT true,
  vendor text NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active
  ON public.recurring_expenses(is_active, due_day) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_recurring_expenses" ON public.recurring_expenses;
CREATE POLICY "admin_full_access_recurring_expenses"
  ON public.recurring_expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

-- 1B · client_payments extensions
ALTER TABLE public.client_payments
  ADD COLUMN IF NOT EXISTS amount_override numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS notes_override text NULL,
  ADD COLUMN IF NOT EXISTS invoice_number text NULL,
  ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NULL;

COMMENT ON COLUMN public.client_payments.amount_override IS
  'Override manuale del totale: se NOT NULL sostituisce total_amount nei calcoli Finance.';

-- 1C · creator_payments extensions
ALTER TABLE public.creator_payments
  ADD COLUMN IF NOT EXISTS amount_override numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS notes_override text NULL,
  ADD COLUMN IF NOT EXISTS paid_via text NULL;

COMMENT ON COLUMN public.creator_payments.amount_override IS
  'Override manuale del totale pagato: se NOT NULL sostituisce total_amount nei calcoli Finance.';

-- 1D · link financial_entries -> recurring_expenses
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS recurring_expense_id uuid NULL
    REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_recurring
  ON public.financial_entries(recurring_expense_id, date)
  WHERE recurring_expense_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_payments_paid_at
  ON public.client_payments(paid_at) WHERE is_paid = true;
CREATE INDEX IF NOT EXISTS idx_creator_payments_paid_at
  ON public.creator_payments(paid_at) WHERE is_paid = true;

-- 2 · Recurring generation
CREATE OR REPLACE FUNCTION public.generate_recurring_expense_entries(p_months_ahead int DEFAULT 3)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_offset int;
  v_year int;
  v_month int;
  v_day int;
  v_max_day int;
  v_date date;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT id, name, amount, category, due_day, start_date, end_date
    FROM public.recurring_expenses
    WHERE is_active = true
  LOOP
    FOR v_offset IN 0..p_months_ahead LOOP
      v_year  := EXTRACT(YEAR  FROM (CURRENT_DATE + (v_offset || ' months')::interval))::int;
      v_month := EXTRACT(MONTH FROM (CURRENT_DATE + (v_offset || ' months')::interval))::int;
      v_max_day := EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1)) + interval '1 month - 1 day'))::int;
      v_day := LEAST(r.due_day, v_max_day);
      v_date := make_date(v_year, v_month, v_day);

      IF v_date < r.start_date THEN CONTINUE; END IF;
      IF r.end_date IS NOT NULL AND v_date > r.end_date THEN CONTINUE; END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.financial_entries fe
        WHERE fe.recurring_expense_id = r.id
          AND date_trunc('month', fe.date) = date_trunc('month', v_date)
      ) THEN
        INSERT INTO public.financial_entries
          (type, category, description, amount, date, due_date, status, recurring_expense_id, notes)
        VALUES
          ('cost', r.category, r.name, r.amount, v_date, v_date, 'expected', r.id, 'Generato automaticamente da spesa ricorrente');
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_recurring_expense_entries(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.trigger_generate_recurring_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    PERFORM public.generate_recurring_expense_entries(3);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recurring_expenses_after_change ON public.recurring_expenses;
CREATE TRIGGER recurring_expenses_after_change
  AFTER INSERT OR UPDATE OF amount, due_day, category, is_active, start_date, end_date
  ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_recurring_on_change();

-- 3 · Unified view
CREATE OR REPLACE VIEW public.v_financial_movements AS
SELECT
  cp.id::text                                       AS id,
  'client_payment'::text                            AS source,
  'revenue'::text                                   AS type,
  'campaign'::text                                  AS category,
  COALESCE(c.name, 'Campagna') || ' · Ciclo ' || cp.cycle_number AS description,
  COALESCE(cp.amount_override, cp.total_amount)::numeric AS amount,
  COALESCE(cp.received_at::date, cp.paid_at::date, cp.due_date) AS date,
  cp.due_date                                       AS due_date,
  CASE
    WHEN cp.is_paid THEN 'paid'
    WHEN cp.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'expected'
  END                                               AS status,
  cp.campaign_id                                    AS campaign_id,
  NULL::uuid                                        AS creator_id,
  c.client_name                                     AS brand_name,
  cp.invoice_number                                 AS invoice_number,
  cp.notes_override                                 AS notes,
  NULL::uuid                                        AS recurring_expense_id,
  cp.amount_override IS NOT NULL                    AS has_override,
  cp.created_at                                     AS created_at
FROM public.client_payments cp
LEFT JOIN public.campaigns c ON c.id = cp.campaign_id

UNION ALL

SELECT
  cp.id::text,
  'creator_payment'::text,
  'cost'::text,
  'creator_pay'::text,
  COALESCE(cr.name, 'Creator') || ' · ' || cp.period_month || '/' || cp.period_year,
  COALESCE(cp.amount_override, cp.total_amount)::numeric,
  COALESCE(cp.paid_at::date, make_date(cp.period_year, cp.period_month, 28)) AS date,
  make_date(cp.period_year, cp.period_month, 28) AS due_date,
  CASE WHEN cp.is_paid THEN 'paid' ELSE 'expected' END,
  NULL::uuid,
  cp.creator_id,
  NULL::text,
  NULL::text,
  cp.notes_override,
  NULL::uuid,
  cp.amount_override IS NOT NULL,
  cp.created_at
FROM public.creator_payments cp
LEFT JOIN public.creators cr ON cr.id = cp.creator_id

UNION ALL

SELECT
  fe.id::text,
  CASE WHEN fe.recurring_expense_id IS NOT NULL THEN 'recurring_expense' ELSE 'manual_entry' END,
  CASE WHEN fe.type IN ('revenue','invoice_out') THEN 'revenue' ELSE 'cost' END,
  COALESCE(fe.category, 'other'),
  COALESCE(fe.description, 'Movimento'),
  fe.amount::numeric,
  fe.date,
  fe.due_date,
  fe.status,
  fe.campaign_id,
  fe.creator_id,
  fe.brand_name,
  fe.invoice_number,
  fe.notes,
  fe.recurring_expense_id,
  false,
  fe.created_at
FROM public.financial_entries fe;

GRANT SELECT ON public.v_financial_movements TO authenticated;

-- 4 · get_finance_dashboard rewritten on the view
CREATE OR REPLACE FUNCTION public.get_finance_dashboard(p_period text DEFAULT 'month')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end   date := CURRENT_DATE + interval '90 days';
  v_result jsonb;
  v_cash_in_bank numeric;
  v_cash_updated_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_start := CASE p_period
    WHEN 'month' THEN date_trunc('month', CURRENT_DATE)::date
    WHEN '3m'    THEN (date_trunc('month', CURRENT_DATE) - interval '2 months')::date
    WHEN '6m'    THEN (date_trunc('month', CURRENT_DATE) - interval '5 months')::date
    WHEN 'year'  THEN date_trunc('year', CURRENT_DATE)::date
    ELSE date_trunc('month', CURRENT_DATE)::date
  END;

  SELECT (value->>'amount')::numeric, (value->>'updated_at')::timestamptz
    INTO v_cash_in_bank, v_cash_updated_at
  FROM public.settings WHERE key = 'finance_cash';

  WITH movements AS (
    SELECT * FROM public.v_financial_movements
  ),
  revenue_paid AS (
    SELECT COALESCE(SUM(amount),0) AS total FROM movements
    WHERE type='revenue' AND status='paid' AND date >= v_start AND date < v_start + interval '1 month'
  ),
  revenue_prev AS (
    SELECT COALESCE(SUM(amount),0) AS total FROM movements
    WHERE type='revenue' AND status='paid'
      AND date >= (v_start - interval '1 month')
      AND date <  v_start
  ),
  costs_month AS (
    SELECT category, COALESCE(SUM(amount),0) AS amount
    FROM movements
    WHERE type='cost' AND status='paid' AND date >= v_start AND date < v_start + interval '1 month'
    GROUP BY category
  ),
  burn AS (
    SELECT COALESCE(SUM(amount),0)/3.0 AS avg3
    FROM movements
    WHERE type='cost' AND status='paid'
      AND date >= (date_trunc('month', CURRENT_DATE) - interval '3 months')
      AND date <  date_trunc('month', CURRENT_DATE)
  ),
  cash_expected AS (
    SELECT COALESCE(SUM(amount),0) AS total
    FROM movements
    WHERE type='revenue' AND status IN ('expected','overdue')
  ),
  monthly_rev AS (
    SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS month, COALESCE(SUM(amount),0) AS revenue
    FROM movements
    WHERE type='revenue' AND status='paid'
      AND date >= (date_trunc('month', CURRENT_DATE) - interval '5 months')
    GROUP BY 1 ORDER BY 1
  ),
  monthly_cost AS (
    SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS month, COALESCE(SUM(amount),0) AS cost
    FROM movements
    WHERE type='cost' AND status='paid'
      AND date >= (date_trunc('month', CURRENT_DATE) - interval '5 months')
    GROUP BY 1 ORDER BY 1
  ),
  flows AS (
    SELECT id, type, description, amount, date, status
    FROM movements
    WHERE status IN ('expected','overdue') AND date BETWEEN v_start AND v_end
    ORDER BY date ASC LIMIT 50
  ),
  by_campaign AS (
    SELECT m.campaign_id::text AS campaign_id,
           c.name AS campaign,
           c.client_name AS brand,
           COALESCE(SUM(CASE WHEN m.source='client_payment' THEN m.amount END),0) AS revenue,
           bool_and(m.status='paid') FILTER (WHERE m.source='client_payment') AS all_paid,
           bool_or (m.status='paid') FILTER (WHERE m.source='client_payment') AS any_paid
    FROM movements m
    LEFT JOIN public.campaigns c ON c.id = m.campaign_id
    WHERE m.campaign_id IS NOT NULL
      AND m.date >= v_start
    GROUP BY m.campaign_id, c.name, c.client_name
  ),
  margins_by_campaign AS (
    SELECT
      c.id::text AS campaign_id,
      c.name AS campaign,
      COALESCE(SUM(CASE WHEN m.source='client_payment'  AND m.status='paid' THEN m.amount END),0) AS revenue,
      COALESCE(SUM(CASE WHEN m.source='creator_payment' AND m.status='paid' THEN m.amount END),0) AS creator_cost,
      0::numeric AS operator_cost
    FROM public.campaigns c
    LEFT JOIN movements m ON m.campaign_id = c.id AND m.date >= v_start
    GROUP BY c.id, c.name
  )
  SELECT jsonb_build_object(
    'cash', jsonb_build_object(
      'in_bank',        v_cash_in_bank,
      'updated_at',     v_cash_updated_at,
      'burn_monthly',   (SELECT COALESCE(SUM(amount),0) FROM costs_month),
      'avg_burn_3m',    (SELECT avg3 FROM burn),
      'runway_months',  CASE WHEN (SELECT avg3 FROM burn) > 0 AND v_cash_in_bank IS NOT NULL
                             THEN v_cash_in_bank / (SELECT avg3 FROM burn) END,
      'cash_expected',  (SELECT total FROM cash_expected)
    ),
    'revenue', jsonb_build_object(
      'mtd',        (SELECT total FROM revenue_paid),
      'prev_month', (SELECT total FROM revenue_prev),
      'mom_pct',    CASE WHEN (SELECT total FROM revenue_prev) > 0
                         THEN ROUND(((SELECT total FROM revenue_paid) - (SELECT total FROM revenue_prev))
                                    / (SELECT total FROM revenue_prev) * 100, 2) END,
      'pipeline',   (SELECT total FROM cash_expected),
      'top_brands', COALESCE((SELECT jsonb_agg(jsonb_build_object('brand', brand_name, 'revenue', s))
                              FROM (SELECT brand_name, SUM(amount) s FROM movements
                                    WHERE type='revenue' AND status='paid' AND brand_name IS NOT NULL
                                      AND date >= v_start
                                    GROUP BY brand_name ORDER BY s DESC LIMIT 5) t), '[]'::jsonb),
      'by_campaign', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                  'campaign_id', campaign_id, 'campaign', campaign, 'brand', brand,
                                  'revenue_fixed', 0, 'revenue_variable', revenue, 'revenue_total', revenue,
                                  'all_paid', all_paid, 'any_paid', any_paid)) FROM by_campaign), '[]'::jsonb),
      'monthly',     COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'revenue', revenue)) FROM monthly_rev), '[]'::jsonb)
    ),
    'costs', jsonb_build_object(
      'by_category', COALESCE((SELECT jsonb_agg(jsonb_build_object('category', category, 'amount', amount)) FROM costs_month), '[]'::jsonb),
      'monthly',     COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'cost', cost)) FROM monthly_cost), '[]'::jsonb)
    ),
    'margins', (
      SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(revenue),0),
        'total_costs',   COALESCE(SUM(creator_cost+operator_cost),0),
        'gross',         COALESCE(SUM(revenue)-SUM(creator_cost+operator_cost),0),
        'gross_pct',     CASE WHEN SUM(revenue) > 0 THEN ROUND((SUM(revenue)-SUM(creator_cost+operator_cost))/SUM(revenue)*100,2) ELSE 0 END,
        'pl',            COALESCE(SUM(revenue)-SUM(creator_cost+operator_cost),0),
        'by_campaign',   COALESCE(jsonb_agg(jsonb_build_object(
                            'campaign_id', campaign_id, 'campaign', campaign,
                            'revenue', revenue, 'creator_cost', creator_cost, 'operator_cost', operator_cost,
                            'margin', revenue - creator_cost - operator_cost,
                            'margin_pct', CASE WHEN revenue > 0 THEN ROUND((revenue-creator_cost-operator_cost)/revenue*100,2) ELSE 0 END)), '[]'::jsonb),
        'by_creator',    '[]'::jsonb
      ) FROM margins_by_campaign
    ),
    'invoices', '[]'::jsonb,
    'flows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', id, 'type', type, 'description', description, 'amount', amount,
                'date', date, 'status', status)) FROM flows), '[]'::jsonb),
    'forecast', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_finance_dashboard(text) TO authenticated;

-- 5 · Daily cron (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finance-daily-jobs') THEN
    PERFORM cron.unschedule('finance-daily-jobs');
  END IF;
  PERFORM cron.schedule(
    'finance-daily-jobs',
    '0 6 * * *',
    'SELECT public.generate_recurring_expense_entries(3);'
  );
END $$;


CREATE OR REPLACE FUNCTION public.fin_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('revenue','cost','invoice_in','invoice_out')),
  category text,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','confirmed','received','paid','overdue')),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  brand_name text,
  creator_id uuid REFERENCES public.creators(id) ON DELETE SET NULL,
  invoice_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage financial_entries"
  ON public.financial_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_fin_entries_date ON public.financial_entries(date);
CREATE INDEX idx_fin_entries_type_status ON public.financial_entries(type, status);
CREATE INDEX idx_fin_entries_campaign ON public.financial_entries(campaign_id);
CREATE INDEX idx_fin_entries_creator ON public.financial_entries(creator_id);

CREATE TRIGGER trg_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at();

CREATE OR REPLACE FUNCTION public.update_finance_cash(p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.settings(key, value, updated_at)
  VALUES ('finance_cash_in_bank', p_amount::text, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  INSERT INTO public.settings(key, value, updated_at)
  VALUES ('finance_cash_updated_at', now()::text, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.get_finance_dashboard(p_period text DEFAULT 'month')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now date := CURRENT_DATE;
  v_month_start date := date_trunc('month', v_now)::date;
  v_prev_month_start date := (date_trunc('month', v_now) - interval '1 month')::date;
  v_prev_month_end date := (date_trunc('month', v_now) - interval '1 day')::date;
  v_period_start date;
  v_3m_start date := (date_trunc('month', v_now) - interval '2 months')::date;
  v_6m_start date := (date_trunc('month', v_now) - interval '5 months')::date;
  v_cash numeric;
  v_cash_updated text;
  v_burn numeric;
  v_avg_burn numeric;
  v_runway numeric;
  v_cash_expected numeric;
  v_revenue_mtd numeric;
  v_revenue_prev numeric;
  v_pipeline numeric;
  v_top_brands jsonb;
  v_campaign_revenue jsonb;
  v_revenue_monthly jsonb;
  v_costs_by_cat jsonb;
  v_costs_monthly jsonb;
  v_margins_campaign jsonb;
  v_margins_creator jsonb;
  v_pl numeric;
  v_total_revenue numeric;
  v_total_costs numeric;
  v_invoices jsonb;
  v_flows jsonb;
  v_forecast jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_period_start := CASE p_period
    WHEN '3m' THEN v_3m_start
    WHEN '6m' THEN v_6m_start
    WHEN 'year' THEN (date_trunc('year', v_now))::date
    ELSE v_month_start
  END;

  SELECT value::numeric INTO v_cash FROM settings WHERE key='finance_cash_in_bank';
  SELECT value INTO v_cash_updated FROM settings WHERE key='finance_cash_updated_at';

  WITH rev AS (
    SELECT COALESCE(SUM(amount),0) AS s FROM (
      SELECT total_amount AS amount FROM client_payments
        WHERE due_date >= v_period_start AND due_date <= v_now
      UNION ALL
      SELECT amount FROM financial_entries
        WHERE type='revenue' AND status IN ('confirmed','received')
        AND date >= v_period_start AND date <= v_now
    ) t
  ),
  cst AS (
    SELECT COALESCE(SUM(amount),0) AS s FROM (
      SELECT total_amount AS amount FROM creator_payments
        WHERE period_end >= v_period_start AND period_end <= v_now
      UNION ALL
      SELECT amount FROM financial_entries
        WHERE type='cost' AND status IN ('confirmed','paid')
        AND date >= v_period_start AND date <= v_now
    ) t
  )
  SELECT rev.s, cst.s INTO v_total_revenue, v_total_costs FROM rev, cst;

  v_pl := v_total_revenue - v_total_costs;

  SELECT COALESCE(SUM(total_amount),0) +
    COALESCE((SELECT SUM(amount) FROM financial_entries
              WHERE type='cost' AND status IN ('confirmed','paid')
              AND date >= v_month_start AND date <= v_now),0)
  INTO v_burn
  FROM creator_payments WHERE period_end >= v_month_start AND period_end <= v_now;

  SELECT COALESCE(AVG(monthly), 0) INTO v_avg_burn FROM (
    SELECT date_trunc('month', d)::date AS m, SUM(amount) AS monthly
    FROM (
      SELECT period_end AS d, total_amount AS amount FROM creator_payments
        WHERE period_end >= v_3m_start AND period_end <= v_now
      UNION ALL
      SELECT date AS d, amount FROM financial_entries
        WHERE type='cost' AND status IN ('confirmed','paid')
        AND date >= v_3m_start AND date <= v_now
    ) t
    GROUP BY date_trunc('month', d)
  ) m;

  v_runway := CASE WHEN COALESCE(v_avg_burn,0) > 0 THEN COALESCE(v_cash,0) / v_avg_burn ELSE NULL END;

  SELECT COALESCE(SUM(total_amount),0) +
    COALESCE((SELECT SUM(amount) FROM financial_entries
              WHERE type IN ('invoice_out','revenue') AND status NOT IN ('received','paid')),0)
  INTO v_cash_expected
  FROM client_payments WHERE is_paid = false;

  SELECT COALESCE(SUM(total_amount),0) +
    COALESCE((SELECT SUM(amount) FROM financial_entries
              WHERE type='revenue' AND status IN ('confirmed','received')
              AND date >= v_month_start AND date <= v_now),0)
  INTO v_revenue_mtd
  FROM client_payments WHERE due_date >= v_month_start AND due_date <= v_now;

  SELECT COALESCE(SUM(total_amount),0) +
    COALESCE((SELECT SUM(amount) FROM financial_entries
              WHERE type='revenue' AND status IN ('confirmed','received')
              AND date >= v_prev_month_start AND date <= v_prev_month_end),0)
  INTO v_revenue_prev
  FROM client_payments WHERE due_date >= v_prev_month_start AND due_date <= v_prev_month_end;

  SELECT COALESCE(SUM(amount),0) INTO v_pipeline
  FROM financial_entries
  WHERE type IN ('revenue','invoice_out') AND status='expected';

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.revenue DESC), '[]'::jsonb)
  INTO v_top_brands
  FROM (
    SELECT brand, SUM(amount) AS revenue FROM (
      SELECT c.client_name AS brand, cp.total_amount AS amount
        FROM client_payments cp JOIN campaigns c ON c.id=cp.campaign_id
        WHERE cp.due_date >= v_period_start AND cp.due_date <= v_now
      UNION ALL
      SELECT COALESCE(fe.brand_name, c.client_name, 'Altro') AS brand, fe.amount
        FROM financial_entries fe
        LEFT JOIN campaigns c ON c.id=fe.campaign_id
        WHERE fe.type='revenue' AND fe.status IN ('confirmed','received')
        AND fe.date >= v_period_start AND fe.date <= v_now
    ) u
    WHERE brand IS NOT NULL
    GROUP BY brand
    ORDER BY revenue DESC
    LIMIT 3
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.revenue_total DESC), '[]'::jsonb)
  INTO v_campaign_revenue
  FROM (
    SELECT
      c.id AS campaign_id,
      c.name AS campaign,
      c.client_name AS brand,
      COALESCE(SUM(cp.fixed_amount),0) AS revenue_fixed,
      COALESCE(SUM(cp.cpm_amount),0) AS revenue_variable,
      COALESCE(SUM(cp.total_amount),0) AS revenue_total,
      bool_and(cp.is_paid) AS all_paid,
      bool_or(cp.is_paid) AS any_paid
    FROM campaigns c
    LEFT JOIN client_payments cp ON cp.campaign_id=c.id
      AND cp.due_date >= v_period_start AND cp.due_date <= v_now
    GROUP BY c.id, c.name, c.client_name
    HAVING COALESCE(SUM(cp.total_amount),0) > 0
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.month), '[]'::jsonb)
  INTO v_revenue_monthly
  FROM (
    SELECT to_char(m.m, 'YYYY-MM') AS month,
      COALESCE(SUM(r.amount),0) AS revenue
    FROM generate_series(date_trunc('month', v_now) - interval '5 months', date_trunc('month', v_now), interval '1 month') AS m(m)
    LEFT JOIN (
      SELECT due_date AS d, total_amount AS amount FROM client_payments
        WHERE due_date >= v_6m_start
      UNION ALL
      SELECT date AS d, amount FROM financial_entries
        WHERE type='revenue' AND status IN ('confirmed','received')
        AND date >= v_6m_start
    ) r ON date_trunc('month', r.d) = m.m
    GROUP BY m.m
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.amount DESC), '[]'::jsonb)
  INTO v_costs_by_cat
  FROM (
    SELECT category, SUM(amount) AS amount FROM (
      SELECT 'creator_pay' AS category, total_amount AS amount FROM creator_payments
        WHERE period_end >= v_period_start AND period_end <= v_now
      UNION ALL
      SELECT COALESCE(category,'other') AS category, amount FROM financial_entries
        WHERE type='cost' AND status IN ('confirmed','paid')
        AND date >= v_period_start AND date <= v_now
    ) c
    GROUP BY category
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.month), '[]'::jsonb)
  INTO v_costs_monthly
  FROM (
    SELECT to_char(m.m, 'YYYY-MM') AS month,
      COALESCE(SUM(r.amount),0) AS cost
    FROM generate_series(date_trunc('month', v_now) - interval '5 months', date_trunc('month', v_now), interval '1 month') AS m(m)
    LEFT JOIN (
      SELECT period_end AS d, total_amount AS amount FROM creator_payments
        WHERE period_end >= v_6m_start
      UNION ALL
      SELECT date AS d, amount FROM financial_entries
        WHERE type='cost' AND status IN ('confirmed','paid')
        AND date >= v_6m_start
    ) r ON date_trunc('month', r.d) = m.m
    GROUP BY m.m
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.margin), '[]'::jsonb)
  INTO v_margins_campaign
  FROM (
    SELECT
      c.id AS campaign_id,
      c.name AS campaign,
      COALESCE((SELECT SUM(cp.total_amount) FROM client_payments cp WHERE cp.campaign_id=c.id AND cp.due_date >= v_period_start AND cp.due_date <= v_now),0) AS revenue,
      COALESCE((SELECT SUM(cpay.total_amount) FROM creator_payments cpay
        JOIN campaign_creators cc ON cc.creator_id=cpay.creator_id
        WHERE cc.campaign_id=c.id AND cpay.period_end >= v_period_start AND cpay.period_end <= v_now),0) AS creator_cost,
      COALESCE((SELECT SUM(fe.amount) FROM financial_entries fe
        WHERE fe.campaign_id=c.id AND fe.type='cost' AND fe.category='operator_pay'
        AND fe.status IN ('confirmed','paid')
        AND fe.date >= v_period_start AND fe.date <= v_now),0) AS operator_cost,
      0::numeric AS margin,
      0::numeric AS margin_pct
    FROM campaigns c
  ) base
  WHERE (base.revenue + base.creator_cost + base.operator_cost) > 0;

  -- compute margins client-side (already includes 0s); recompute with proper values:
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'campaign_id', campaign_id,
    'campaign', campaign,
    'revenue', revenue,
    'creator_cost', creator_cost,
    'operator_cost', operator_cost,
    'margin', revenue - creator_cost - operator_cost,
    'margin_pct', CASE WHEN revenue > 0 THEN ((revenue - creator_cost - operator_cost) / revenue * 100) ELSE 0 END
  ) ORDER BY (revenue - creator_cost - operator_cost)), '[]'::jsonb)
  INTO v_margins_campaign
  FROM (
    SELECT
      c.id AS campaign_id,
      c.name AS campaign,
      COALESCE((SELECT SUM(cp.total_amount) FROM client_payments cp WHERE cp.campaign_id=c.id AND cp.due_date >= v_period_start AND cp.due_date <= v_now),0) AS revenue,
      COALESCE((SELECT SUM(cpay.total_amount) FROM creator_payments cpay
        JOIN campaign_creators cc ON cc.creator_id=cpay.creator_id
        WHERE cc.campaign_id=c.id AND cpay.period_end >= v_period_start AND cpay.period_end <= v_now),0) AS creator_cost,
      COALESCE((SELECT SUM(fe.amount) FROM financial_entries fe
        WHERE fe.campaign_id=c.id AND fe.type='cost' AND fe.category='operator_pay'
        AND fe.status IN ('confirmed','paid')
        AND fe.date >= v_period_start AND fe.date <= v_now),0) AS operator_cost
    FROM campaigns c
  ) base
  WHERE (revenue + creator_cost + operator_cost) > 0;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'creator_id', creator_id,
    'creator', creator,
    'cost', cost,
    'revenue', revenue,
    'margin', revenue - cost,
    'margin_pct', CASE WHEN revenue > 0 THEN ((revenue - cost) / revenue * 100) ELSE 0 END
  ) ORDER BY (revenue - cost)), '[]'::jsonb)
  INTO v_margins_creator
  FROM (
    SELECT
      cr.id AS creator_id,
      cr.name AS creator,
      COALESCE((SELECT SUM(cp.total_amount) FROM creator_payments cp WHERE cp.creator_id=cr.id AND cp.period_end >= v_period_start AND cp.period_end <= v_now),0) AS cost,
      COALESCE((
        SELECT SUM(cp.total_amount)
        FROM client_payments cp
        JOIN campaign_creators cc ON cc.campaign_id=cp.campaign_id
        WHERE cc.creator_id=cr.id AND cp.due_date >= v_period_start AND cp.due_date <= v_now
      ),0) AS revenue
    FROM creators cr
  ) base
  WHERE (cost + revenue) > 0;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.due_date DESC NULLS LAST), '[]'::jsonb)
  INTO v_invoices
  FROM (
    SELECT id, invoice_number, type, brand_name, amount, date, due_date,
      CASE WHEN status NOT IN ('paid','received') AND due_date IS NOT NULL AND due_date < v_now THEN 'overdue' ELSE status END AS status,
      description
    FROM financial_entries
    WHERE type IN ('invoice_in','invoice_out')
    ORDER BY due_date DESC NULLS LAST
    LIMIT 200
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.date), '[]'::jsonb)
  INTO v_flows
  FROM (
    SELECT id, type, description, amount, date, status, category
    FROM financial_entries
    WHERE status IN ('expected','confirmed')
    ORDER BY date
    LIMIT 200
  ) t;

  SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.date) INTO v_forecast
  FROM (
    WITH days AS (
      SELECT generate_series(v_now, v_now + interval '90 days', interval '1 day')::date AS d
    ),
    rev_conf AS (
      SELECT date AS d, SUM(amount) AS a FROM financial_entries
      WHERE type IN ('revenue','invoice_out') AND status IN ('confirmed','received','paid')
        AND date BETWEEN v_now AND v_now + interval '90 days'
      GROUP BY date
    ),
    rev_pipe AS (
      SELECT date AS d, SUM(amount) AS a FROM financial_entries
      WHERE type IN ('revenue','invoice_out') AND status='expected'
        AND date BETWEEN v_now AND v_now + interval '90 days'
      GROUP BY date
    ),
    cost_conf AS (
      SELECT date AS d, SUM(amount) AS a FROM financial_entries
      WHERE type IN ('cost','invoice_in') AND status IN ('confirmed','paid')
        AND date BETWEEN v_now AND v_now + interval '90 days'
      GROUP BY date
    )
    SELECT
      to_char(days.d, 'YYYY-MM-DD') AS date,
      SUM(COALESCE(rev_conf.a,0) - COALESCE(cost_conf.a,0)) OVER (ORDER BY days.d) AS pessimistic,
      SUM(COALESCE(rev_conf.a,0) + COALESCE(rev_pipe.a,0)*0.5 - COALESCE(cost_conf.a,0)) OVER (ORDER BY days.d) AS base,
      SUM(COALESCE(rev_conf.a,0) + COALESCE(rev_pipe.a,0) - COALESCE(cost_conf.a,0)) OVER (ORDER BY days.d) AS optimistic
    FROM days
    LEFT JOIN rev_conf ON rev_conf.d = days.d
    LEFT JOIN rev_pipe ON rev_pipe.d = days.d
    LEFT JOIN cost_conf ON cost_conf.d = days.d
  ) t;

  RETURN jsonb_build_object(
    'cash', jsonb_build_object(
      'in_bank', v_cash,
      'updated_at', v_cash_updated,
      'burn_monthly', v_burn,
      'avg_burn_3m', v_avg_burn,
      'runway_months', v_runway,
      'cash_expected', v_cash_expected
    ),
    'revenue', jsonb_build_object(
      'mtd', v_revenue_mtd,
      'prev_month', v_revenue_prev,
      'mom_pct', CASE WHEN COALESCE(v_revenue_prev,0) > 0 THEN ((v_revenue_mtd - v_revenue_prev) / v_revenue_prev * 100) ELSE NULL END,
      'pipeline', v_pipeline,
      'top_brands', v_top_brands,
      'by_campaign', v_campaign_revenue,
      'monthly', v_revenue_monthly
    ),
    'costs', jsonb_build_object(
      'by_category', v_costs_by_cat,
      'monthly', v_costs_monthly
    ),
    'margins', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_costs', v_total_costs,
      'gross', v_pl,
      'gross_pct', CASE WHEN COALESCE(v_total_revenue,0) > 0 THEN (v_pl / v_total_revenue * 100) ELSE 0 END,
      'pl', v_pl,
      'by_campaign', v_margins_campaign,
      'by_creator', v_margins_creator
    ),
    'invoices', v_invoices,
    'flows', v_flows,
    'forecast', COALESCE(v_forecast, '[]'::jsonb)
  );
END $$;

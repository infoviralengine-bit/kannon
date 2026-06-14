
CREATE OR REPLACE FUNCTION public.get_finance_dashboard(p_period text DEFAULT 'month')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end   date := CURRENT_DATE + interval '90 days';
  v_result jsonb;
  v_cash_in_bank numeric := NULL;
  v_cash_updated_at timestamptz := NULL;
  v_settings_value text;
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

  BEGIN
    SELECT value INTO v_settings_value FROM public.settings WHERE key = 'finance_cash';
    IF v_settings_value IS NOT NULL AND v_settings_value <> '' THEN
      v_cash_in_bank := NULLIF((v_settings_value::jsonb)->>'amount', '')::numeric;
      v_cash_updated_at := NULLIF((v_settings_value::jsonb)->>'updated_at', '')::timestamptz;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_cash_in_bank := NULL;
    v_cash_updated_at := NULL;
  END;

  -- Fallback: legacy KV keys (finance_cash_in_bank / finance_cash_updated_at) written as plain text
  IF v_cash_in_bank IS NULL THEN
    BEGIN
      SELECT value INTO v_settings_value FROM public.settings WHERE key = 'finance_cash_in_bank';
      IF v_settings_value IS NOT NULL AND v_settings_value <> '' THEN
        v_cash_in_bank := v_settings_value::numeric;
      END IF;
    EXCEPTION WHEN OTHERS THEN v_cash_in_bank := NULL; END;
    BEGIN
      SELECT value INTO v_settings_value FROM public.settings WHERE key = 'finance_cash_updated_at';
      IF v_settings_value IS NOT NULL AND v_settings_value <> '' THEN
        v_cash_updated_at := v_settings_value::timestamptz;
      END IF;
    EXCEPTION WHEN OTHERS THEN v_cash_updated_at := NULL; END;
  END IF;

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

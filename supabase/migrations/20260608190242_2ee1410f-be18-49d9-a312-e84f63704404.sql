-- 1. Add invoice_sent column (idempotent)
ALTER TABLE client_payments
ADD COLUMN IF NOT EXISTS invoice_sent BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE client_payments SET invoice_sent = TRUE WHERE is_paid = TRUE AND invoice_sent = FALSE;

-- 2. Remove video_views_cap for Finanz
UPDATE campaigns SET video_views_cap = NULL WHERE name = 'Finanz';

-- 3. FORCE FIX Finanz cycle_numbers + cumulative
DO $$
DECLARE
  v_campaign_id UUID;
  v_april_id UUID;
  v_may_id UUID;
  v_june_id UUID;
  v_april_views BIGINT;
BEGIN
  SELECT id INTO v_campaign_id FROM campaigns WHERE name = 'Finanz' LIMIT 1;
  IF v_campaign_id IS NULL THEN
    RAISE NOTICE 'Finanz non trovata, skip';
    RETURN;
  END IF;

  SELECT id, cpm_views INTO v_april_id, v_april_views
  FROM client_payments
  WHERE campaign_id = v_campaign_id AND due_date = '2026-04-01' AND is_paid = TRUE
  LIMIT 1;

  SELECT id INTO v_may_id
  FROM client_payments
  WHERE campaign_id = v_campaign_id AND due_date = '2026-05-01' AND is_paid = TRUE
  LIMIT 1;

  SELECT id INTO v_june_id
  FROM client_payments
  WHERE campaign_id = v_campaign_id AND is_paid = FALSE
  ORDER BY due_date DESC
  LIMIT 1;

  RAISE NOTICE 'Finanz rows: April=%, May=%, June=%, April_views=%',
    v_april_id, v_may_id, v_june_id, v_april_views;

  IF v_april_id IS NOT NULL THEN
    UPDATE client_payments
    SET cycle_number = 1,
        views_paid_cumulative = COALESCE(views_paid_cumulative, cpm_views)
    WHERE id = v_april_id;
  END IF;

  IF v_may_id IS NOT NULL THEN
    UPDATE client_payments
    SET cycle_number = 2,
        views_paid_cumulative = 807863,
        amount_overridden = TRUE,
        cpm_views = 807863 - COALESCE(v_april_views, 0),
        cpm_amount = ROUND(((807863 - COALESCE(v_april_views, 0)) * 1.5 / 1000)::numeric, 2),
        total_amount = ROUND(((807863 - COALESCE(v_april_views, 0)) * 1.5 / 1000)::numeric, 2),
        invoice_sent = TRUE
    WHERE id = v_may_id;
  END IF;

  IF v_june_id IS NOT NULL THEN
    UPDATE client_payments
    SET cycle_number = 3,
        views_paid_cumulative = 0,
        amount_overridden = FALSE,
        cpm_views = 0,
        cpm_amount = 0,
        total_amount = 0
    WHERE id = v_june_id;
  END IF;

  RAISE NOTICE 'Finanz cycle_numbers normalizzati e Maggio backfill forzato a views_paid_cumulative=807863';
END $$;

-- 4. Diagnostic
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== STATO FINANZ DOPO FIX ===';
  FOR r IN
    SELECT cycle_number, due_date, cpm_views, cpm_amount, views_paid_cumulative,
           is_paid, amount_overridden, invoice_sent
    FROM client_payments
    WHERE campaign_id = (SELECT id FROM campaigns WHERE name = 'Finanz')
    ORDER BY cycle_number
  LOOP
    RAISE NOTICE 'cycle=%, due=%, cpm_views=%, cpm_amount=%, cumulative=%, paid=%, override=%, invoiced=%',
      r.cycle_number, r.due_date, r.cpm_views, r.cpm_amount, r.views_paid_cumulative,
      r.is_paid, r.amount_overridden, r.invoice_sent;
  END LOOP;
END $$;
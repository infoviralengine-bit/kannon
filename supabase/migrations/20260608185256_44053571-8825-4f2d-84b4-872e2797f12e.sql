
ALTER TABLE client_payments
ADD COLUMN IF NOT EXISTS invoice_sent BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE client_payments SET invoice_sent = TRUE WHERE is_paid = TRUE;

UPDATE campaigns
SET video_views_cap = NULL
WHERE name = 'Finanz';

DO $$
DECLARE
  v_campaign_id UUID;
  v_backfill_id UUID;
  v_paid_other_views BIGINT;
  v_new_cpm_views BIGINT;
  v_new_amount NUMERIC;
BEGIN
  SELECT id INTO v_campaign_id FROM campaigns WHERE name = 'Finanz' LIMIT 1;
  IF v_campaign_id IS NULL THEN
    RAISE NOTICE 'Finanz campaign non trovata, skip';
    RETURN;
  END IF;

  SELECT id INTO v_backfill_id
  FROM client_payments
  WHERE campaign_id = v_campaign_id
    AND notes LIKE 'Backfill cumulativo storico Finanz%'
  LIMIT 1;

  IF v_backfill_id IS NULL THEN
    RAISE NOTICE 'Backfill row di Finanz non trovata';
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cpm_views), 0) INTO v_paid_other_views
  FROM client_payments
  WHERE campaign_id = v_campaign_id
    AND id <> v_backfill_id
    AND is_paid = TRUE;

  v_new_cpm_views := 807863 - v_paid_other_views;
  v_new_amount := ROUND((v_new_cpm_views * 1.5 / 1000)::numeric, 2);

  UPDATE client_payments
  SET views_paid_cumulative = 807863,
      amount_overridden = TRUE,
      cpm_views = v_new_cpm_views,
      cpm_amount = v_new_amount,
      total_amount = v_new_amount,
      invoice_sent = TRUE
  WHERE id = v_backfill_id;

  RAISE NOTICE 'Backfill row Finanz: cpm_views=%, amount=%', v_new_cpm_views, v_new_amount;
END $$;

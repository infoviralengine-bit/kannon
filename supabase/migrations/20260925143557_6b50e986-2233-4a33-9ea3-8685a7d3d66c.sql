CREATE OR REPLACE FUNCTION public.sync_campaign_cycles(p_campaign_id uuid, p_apply boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_last_num integer;
  v_last_end date;
  v_num integer;
  v_start date;
  v_end date;
  v_limit date;
  v_due date;
  v_cycle_id uuid;
  v_last_video_date date;
  v_plan jsonb := '[]'::jsonb;
  v_guard integer := 0;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR c.start_date IS NULL THEN RETURN v_plan; END IF;
  IF COALESCE(c.payment_terms->>'type', 'standard_lagged') = 'tot_split' THEN RETURN v_plan; END IF;

  SELECT pc.cycle_number, pc.cycle_end_date
  INTO v_last_num, v_last_end
  FROM public.client_payments p
  JOIN public.payment_cycles pc ON pc.id = p.cycle_id
  WHERE p.campaign_id = p_campaign_id AND p.is_paid
  ORDER BY pc.cycle_number DESC
  LIMIT 1;

  IF v_last_num IS NULL THEN
    v_num := 1;
    v_start := c.start_date;
  ELSE
    v_num := v_last_num + 1;
    v_start := v_last_end + 1;
  END IF;

  v_limit := COALESCE(c.end_date, GREATEST(CURRENT_DATE, c.start_date) + 30);

  WHILE v_guard < 60 LOOP
    v_end := v_start + 29;
    EXIT WHEN c.end_date IS NOT NULL AND v_end > c.end_date;
    EXIT WHEN c.end_date IS NULL AND v_start > v_limit;

    v_guard := v_guard + 1;
    v_due := (c.start_date + make_interval(months => v_num - 1) + interval '7 days')::date;
    v_plan := v_plan || jsonb_build_object(
      'cycle_number', v_num,
      'start', v_start,
      'end', v_end,
      'due', v_due,
      'is_last', false,
      'fixed', COALESCE(c.client_fixed, 0)
    );

    IF p_apply THEN
      v_cycle_id := NULL;
      SELECT id INTO v_cycle_id
      FROM public.payment_cycles
      WHERE campaign_id = p_campaign_id AND cycle_number = v_num
      ORDER BY created_at
      LIMIT 1;

      IF v_cycle_id IS NULL THEN
        INSERT INTO public.payment_cycles (
          campaign_id, cycle_number, cycle_start_date, cycle_end_date, is_last_cycle
        ) VALUES (
          p_campaign_id, v_num, v_start, v_end, false
        ) RETURNING id INTO v_cycle_id;
      ELSE
        UPDATE public.payment_cycles
        SET cycle_start_date = v_start,
            cycle_end_date = v_end,
            is_last_cycle = false
        WHERE id = v_cycle_id;
      END IF;

      IF EXISTS (SELECT 1 FROM public.client_payments WHERE cycle_id = v_cycle_id) THEN
        UPDATE public.client_payments
        SET due_date = v_due,
            fixed_amount = COALESCE(c.client_fixed, 0),
            cpm_views = CASE WHEN v_num = 1 THEN 0 ELSE cpm_views END,
            cpm_amount = CASE WHEN v_num = 1 THEN 0 ELSE cpm_amount END,
            total_amount = COALESCE(c.client_fixed, 0) + CASE WHEN v_num = 1 THEN 0 ELSE cpm_amount END,
            views_paid_cumulative = CASE WHEN v_num = 1 THEN 0 ELSE views_paid_cumulative END,
            cycle_number = v_num
        WHERE cycle_id = v_cycle_id AND NOT is_paid AND NOT amount_overridden;
      ELSE
        INSERT INTO public.client_payments (
          campaign_id, cycle_id, cycle_number, due_date, fixed_amount,
          cpm_views, cpm_amount, total_amount, views_paid_cumulative,
          is_paid, payment_kind
        ) VALUES (
          p_campaign_id, v_cycle_id, v_num, v_due, COALESCE(c.client_fixed, 0),
          0, 0, COALESCE(c.client_fixed, 0), 0,
          false, 'standard'
        );
      END IF;
    END IF;

    v_num := v_num + 1;
    v_start := v_end + 1;
  END LOOP;

  IF c.end_date IS NOT NULL AND c.status = 'completed' THEN
    SELECT MAX(v.published_at::date)
    INTO v_last_video_date
    FROM public.videos v
    JOIN public.tiktok_accounts a ON a.id = v.tiktok_account_id
    WHERE a.campaign_id = p_campaign_id;

    IF v_last_video_date IS NOT NULL THEN
      v_end := GREATEST(c.end_date, v_last_video_date + 30);
      v_due := v_end + 7;
      v_plan := v_plan || jsonb_build_object(
        'cycle_number', v_num,
        'start', v_start,
        'end', v_end,
        'due', v_due,
        'is_last', true,
        'fixed', 0
      );

      IF p_apply THEN
        v_cycle_id := NULL;
        SELECT id INTO v_cycle_id
        FROM public.payment_cycles
        WHERE campaign_id = p_campaign_id AND cycle_number = v_num
        ORDER BY created_at
        LIMIT 1;

        IF v_cycle_id IS NULL THEN
          INSERT INTO public.payment_cycles (
            campaign_id, cycle_number, cycle_start_date, cycle_end_date, is_last_cycle
          ) VALUES (
            p_campaign_id, v_num, v_start, v_end, true
          ) RETURNING id INTO v_cycle_id;
        ELSE
          UPDATE public.payment_cycles
          SET cycle_start_date = v_start,
              cycle_end_date = v_end,
              is_last_cycle = true
          WHERE id = v_cycle_id;
        END IF;

        IF EXISTS (SELECT 1 FROM public.client_payments WHERE cycle_id = v_cycle_id) THEN
          UPDATE public.client_payments
          SET due_date = v_due,
              fixed_amount = 0,
              total_amount = cpm_amount,
              cycle_number = v_num
          WHERE cycle_id = v_cycle_id AND NOT is_paid AND NOT amount_overridden;
        ELSE
          INSERT INTO public.client_payments (
            campaign_id, cycle_id, cycle_number, due_date, fixed_amount,
            cpm_views, cpm_amount, total_amount, views_paid_cumulative,
            is_paid, payment_kind
          ) VALUES (
            p_campaign_id, v_cycle_id, v_num, v_due, 0,
            0, 0, 0, 0,
            false, 'standard'
          );
        END IF;
      END IF;

      v_num := v_num + 1;
    END IF;
  END IF;

  IF p_apply THEN
    DELETE FROM public.client_payments p
    USING public.payment_cycles pc
    WHERE p.cycle_id = pc.id
      AND pc.campaign_id = p_campaign_id
      AND pc.cycle_number >= v_num
      AND NOT p.is_paid;

    DELETE FROM public.payment_cycles pc
    WHERE pc.campaign_id = p_campaign_id
      AND pc.cycle_number >= v_num
      AND NOT EXISTS (
        SELECT 1 FROM public.client_payments p WHERE p.cycle_id = pc.id
      );
  END IF;

  RETURN v_plan;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_campaign_cycle_cpm(p_campaign_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  r record;
  v_running bigint;
  v_total bigint;
  v_views bigint;
  v_cpm numeric;
  v_cutoff date;
  v_n integer := 0;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF COALESCE(c.payment_terms->>'type', 'standard_lagged') = 'tot_split' THEN RETURN 0; END IF;

  SELECT COALESCE(MAX(views_paid_cumulative), 0)
  INTO v_running
  FROM public.client_payments
  WHERE campaign_id = p_campaign_id AND is_paid;

  FOR r IN
    SELECT p.id, p.cycle_number, p.amount_overridden, p.cpm_views,
           pc.cycle_start_date, pc.cycle_end_date, pc.is_last_cycle
    FROM public.client_payments p
    JOIN public.payment_cycles pc ON pc.id = p.cycle_id
    WHERE p.campaign_id = p_campaign_id
      AND NOT p.is_paid
      AND COALESCE(p.payment_kind, 'standard') = 'standard'
    ORDER BY pc.cycle_number
  LOOP
    IF r.amount_overridden THEN
      v_running := v_running + COALESCE(r.cpm_views, 0);
      CONTINUE;
    END IF;

    IF r.cycle_number = 1 THEN
      UPDATE public.client_payments
      SET cpm_views = 0,
          cpm_amount = 0,
          total_amount = fixed_amount,
          views_paid_cumulative = v_running,
          views_snapshot_at = now()
      WHERE id = r.id;
      v_n := v_n + 1;
      CONTINUE;
    END IF;

    v_cutoff := CASE
      WHEN r.is_last_cycle THEN r.cycle_end_date
      ELSE r.cycle_start_date - 1
    END;
    v_total := public.campaign_effective_views_until(p_campaign_id, v_cutoff, c.video_views_cap);
    v_views := GREATEST(0, v_total - v_running);
    v_cpm := ROUND(COALESCE(c.client_cpm, 0) * v_views / 1000.0, 2);
    IF c.monthly_spend_cap IS NOT NULL AND v_cpm > c.monthly_spend_cap THEN
      v_cpm := c.monthly_spend_cap;
    END IF;

    UPDATE public.client_payments
    SET cpm_views = v_views,
        cpm_amount = v_cpm,
        total_amount = fixed_amount + v_cpm,
        views_paid_cumulative = v_running + v_views,
        views_snapshot_at = now()
    WHERE id = r.id;

    v_running := v_running + v_views;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;
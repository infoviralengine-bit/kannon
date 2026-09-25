-- Effective views (cap per video, 30-day window) of a campaign's videos published up to a date (UTC)
CREATE OR REPLACE FUNCTION public.campaign_effective_views_until(p_campaign_id uuid, p_until date, p_cap integer)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN COALESCE(p_cap,0) > 0 THEN LEAST(s.eff, p_cap) ELSE s.eff END), 0)::bigint
  FROM (
    SELECT CASE WHEN v.window_closed THEN COALESCE(v.views_final, v.views, 0) ELSE COALESCE(v.views, 0) END AS eff
    FROM public.videos v
    JOIN public.tiktok_accounts a ON a.id = v.tiktok_account_id
    WHERE a.campaign_id = p_campaign_id
      AND (v.published_at AT TIME ZONE 'UTC')::date <= p_until
  ) s;
$$;

-- Pre-generate / realign 30-day cycles (inclusive) for standard campaigns. Paid cycles are never touched.
CREATE OR REPLACE FUNCTION public.sync_campaign_cycles(p_campaign_id uuid, p_apply boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
  v_last_num int; v_last_end date;
  v_num int; v_start date; v_end date; v_limit date;
  v_is_last boolean; v_fixed numeric; v_cycle_id uuid;
  v_plan jsonb := '[]'::jsonb; v_guard int := 0;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR c.start_date IS NULL THEN RETURN v_plan; END IF;
  IF COALESCE(c.payment_terms->>'type', 'standard_lagged') = 'tot_split' THEN RETURN v_plan; END IF;

  SELECT pc.cycle_number, pc.cycle_end_date INTO v_last_num, v_last_end
  FROM public.client_payments p JOIN public.payment_cycles pc ON pc.id = p.cycle_id
  WHERE p.campaign_id = p_campaign_id AND p.is_paid
  ORDER BY pc.cycle_number DESC LIMIT 1;

  IF v_last_num IS NULL THEN v_num := 1; v_start := c.start_date;
  ELSE v_num := v_last_num + 1; v_start := v_last_end + 1; END IF;

  v_limit := COALESCE(c.end_date, GREATEST(CURRENT_DATE, c.start_date) + 30);

  WHILE v_start <= v_limit AND v_guard < 60 LOOP
    v_guard := v_guard + 1;
    v_end := v_start + 29;
    v_is_last := false;
    IF c.end_date IS NOT NULL AND v_end > c.end_date THEN
      v_end := c.end_date;
      v_is_last := (v_end - v_start + 1) < 30;
    END IF;
    v_fixed := CASE WHEN v_is_last THEN 0 ELSE COALESCE(c.client_fixed, 0) END;
    v_plan := v_plan || jsonb_build_object('cycle_number', v_num, 'start', v_start, 'end', v_end, 'is_last', v_is_last, 'fixed', v_fixed);

    IF p_apply THEN
      v_cycle_id := NULL;
      SELECT id INTO v_cycle_id FROM public.payment_cycles
      WHERE campaign_id = p_campaign_id AND cycle_number = v_num ORDER BY created_at LIMIT 1;
      IF v_cycle_id IS NULL THEN
        INSERT INTO public.payment_cycles (campaign_id, cycle_number, cycle_start_date, cycle_end_date, is_last_cycle)
        VALUES (p_campaign_id, v_num, v_start, v_end, v_is_last) RETURNING id INTO v_cycle_id;
      ELSE
        UPDATE public.payment_cycles SET cycle_start_date = v_start, cycle_end_date = v_end, is_last_cycle = v_is_last
        WHERE id = v_cycle_id;
      END IF;
      IF EXISTS (SELECT 1 FROM public.client_payments WHERE cycle_id = v_cycle_id) THEN
        UPDATE public.client_payments
        SET due_date = v_end, fixed_amount = v_fixed, total_amount = v_fixed + cpm_amount, cycle_number = v_num
        WHERE cycle_id = v_cycle_id AND NOT is_paid;
      ELSE
        INSERT INTO public.client_payments (campaign_id, cycle_id, cycle_number, due_date, fixed_amount, cpm_views, cpm_amount, total_amount, views_paid_cumulative, is_paid, payment_kind)
        VALUES (p_campaign_id, v_cycle_id, v_num, v_end, v_fixed, 0, 0, v_fixed, 0, false, 'standard');
      END IF;
    END IF;

    v_num := v_num + 1;
    v_start := v_end + 1;
  END LOOP;

  IF p_apply THEN
    DELETE FROM public.client_payments p USING public.payment_cycles pc
    WHERE p.cycle_id = pc.id AND pc.campaign_id = p_campaign_id AND pc.cycle_number >= v_num AND NOT p.is_paid;
    DELETE FROM public.payment_cycles pc
    WHERE pc.campaign_id = p_campaign_id AND pc.cycle_number >= v_num
      AND NOT EXISTS (SELECT 1 FROM public.client_payments p WHERE p.cycle_id = pc.id);
  END IF;

  RETURN v_plan;
END;
$$;

-- CPM of each unpaid cycle = views of videos published up to cycle end - views already paid/assigned
CREATE OR REPLACE FUNCTION public.recalc_campaign_cycle_cpm(p_campaign_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record; r record;
  v_running bigint; v_total bigint; v_views bigint; v_cpm numeric; v_n int := 0;
BEGIN
  SELECT * INTO c FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF COALESCE(c.payment_terms->>'type', 'standard_lagged') = 'tot_split' THEN RETURN 0; END IF;

  SELECT COALESCE(MAX(views_paid_cumulative), 0) INTO v_running
  FROM public.client_payments WHERE campaign_id = p_campaign_id AND is_paid;

  FOR r IN
    SELECT p.id, p.amount_overridden, p.cpm_views, pc.cycle_end_date
    FROM public.client_payments p JOIN public.payment_cycles pc ON pc.id = p.cycle_id
    WHERE p.campaign_id = p_campaign_id AND NOT p.is_paid AND COALESCE(p.payment_kind, 'standard') = 'standard'
    ORDER BY pc.cycle_number
  LOOP
    IF r.amount_overridden THEN
      v_running := v_running + COALESCE(r.cpm_views, 0);
      CONTINUE;
    END IF;
    v_total := public.campaign_effective_views_until(p_campaign_id, r.cycle_end_date, c.video_views_cap);
    v_views := GREATEST(0, v_total - v_running);
    v_cpm := ROUND(COALESCE(c.client_cpm, 0) * v_views / 1000.0, 2);
    IF c.monthly_spend_cap IS NOT NULL AND v_cpm > c.monthly_spend_cap THEN v_cpm := c.monthly_spend_cap; END IF;
    UPDATE public.client_payments
    SET cpm_views = v_views, cpm_amount = v_cpm, total_amount = fixed_amount + v_cpm,
        views_paid_cumulative = v_running + v_views, views_snapshot_at = now()
    WHERE id = r.id;
    v_running := v_running + v_views;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- Entry point for scraping (service role) and staff "Ricalcola"
CREATE OR REPLACE FUNCTION public.refresh_campaign_payments(p_campaign_ids uuid[], p_force_sync boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_status text; v_auto boolean; v_n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT COALESCE((SELECT value FROM public.settings WHERE key = 'auto_cycles_enabled' LIMIT 1), 'false') = 'true' INTO v_auto;
  FOREACH v_id IN ARRAY COALESCE(p_campaign_ids, '{}'::uuid[]) LOOP
    SELECT status INTO v_status FROM public.campaigns WHERE id = v_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF p_force_sync OR (v_auto AND v_status = 'active') THEN
      PERFORM public.sync_campaign_cycles(v_id, true);
    END IF;
    v_n := v_n + public.recalc_campaign_cycle_cpm(v_id);
  END LOOP;
  RETURN v_n;
END;
$$;

-- Campaign created or economic terms/dates changed -> realign cycles and CPM
CREATE OR REPLACE FUNCTION public.trg_campaign_sync_cycles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_campaign_cycles(NEW.id, true);
  PERFORM public.recalc_campaign_cycle_cpm(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaigns_sync_cycles ON public.campaigns;
CREATE TRIGGER campaigns_sync_cycles
AFTER INSERT OR UPDATE OF start_date, end_date, client_fixed, client_cpm, video_views_cap, monthly_spend_cap, payment_terms
ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.trg_campaign_sync_cycles();

-- Paid status changed -> following cycles rebase on the frozen snapshot
CREATE OR REPLACE FUNCTION public.trg_client_payment_paid_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_paid IS DISTINCT FROM OLD.is_paid THEN
    PERFORM public.recalc_campaign_cycle_cpm(NEW.campaign_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_payments_paid_recalc ON public.client_payments;
CREATE TRIGGER client_payments_paid_recalc
AFTER UPDATE OF is_paid ON public.client_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_client_payment_paid_recalc();

REVOKE EXECUTE ON FUNCTION public.campaign_effective_views_until(uuid, date, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_campaign_cycles(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_campaign_cycle_cpm(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_campaign_sync_cycles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_client_payment_paid_recalc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_campaign_payments(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_effective_views_until(uuid, date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_campaign_cycles(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalc_campaign_cycle_cpm(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_campaign_payments(uuid[], boolean) TO authenticated, service_role;
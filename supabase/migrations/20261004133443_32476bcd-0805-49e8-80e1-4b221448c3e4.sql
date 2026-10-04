CREATE TABLE public.allocation_creators (creator_id uuid PRIMARY KEY REFERENCES public.creators(id) ON DELETE CASCADE, daily_slots smallint NOT NULL CHECK (daily_slots BETWEEN 1 AND 12), tier text CHECK (tier IN ('A','B','C')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_creators TO authenticated; GRANT ALL ON public.allocation_creators TO service_role;
ALTER TABLE public.allocation_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocation_creators_read ON public.allocation_creators FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'campaign_manager'::app_role));
CREATE POLICY allocation_creators_write ON public.allocation_creators FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));
CREATE TRIGGER allocation_creators_updated BEFORE UPDATE ON public.allocation_creators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.allocation_campaigns (campaign_id uuid PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE, priority smallint NOT NULL CHECK (priority > 0), is_residual boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_campaigns TO authenticated; GRANT ALL ON public.allocation_campaigns TO service_role;
ALTER TABLE public.allocation_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocation_campaigns_read ON public.allocation_campaigns FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'campaign_manager'::app_role));
CREATE POLICY allocation_campaigns_write ON public.allocation_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));
CREATE UNIQUE INDEX allocation_one_residual ON public.allocation_campaigns (is_residual) WHERE is_residual;
CREATE TRIGGER allocation_campaigns_updated BEFORE UPDATE ON public.allocation_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.allocation_weeks (week_start date PRIMARY KEY, residual_auto boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_weeks TO authenticated; GRANT ALL ON public.allocation_weeks TO service_role;
ALTER TABLE public.allocation_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocation_weeks_read ON public.allocation_weeks FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'campaign_manager'::app_role));
CREATE POLICY allocation_weeks_write ON public.allocation_weeks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));
CREATE TRIGGER allocation_weeks_updated BEFORE UPDATE ON public.allocation_weeks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.allocation_slots (week_start date NOT NULL REFERENCES public.allocation_weeks(week_start) ON DELETE CASCADE, creator_id uuid NOT NULL REFERENCES public.allocation_creators(creator_id) ON DELETE CASCADE, slots jsonb NOT NULL DEFAULT '[]'::jsonb, paused boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (week_start,creator_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_slots TO authenticated; GRANT ALL ON public.allocation_slots TO service_role;
ALTER TABLE public.allocation_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocation_slots_read ON public.allocation_slots FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'campaign_manager'::app_role));
CREATE POLICY allocation_slots_write ON public.allocation_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));
CREATE TRIGGER allocation_slots_updated BEFORE UPDATE ON public.allocation_slots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.allocation_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, creator_ids uuid[] NOT NULL DEFAULT '{}'::uuid[], created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_groups TO authenticated; GRANT ALL ON public.allocation_groups TO service_role;
ALTER TABLE public.allocation_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocation_groups_read ON public.allocation_groups FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'campaign_manager'::app_role));
CREATE POLICY allocation_groups_write ON public.allocation_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));
CREATE TRIGGER allocation_groups_updated BEFORE UPDATE ON public.allocation_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.save_allocation_week(p_week date, p_version integer, p_auto boolean, p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_version integer; v_row jsonb; v_creator uuid; v_slots jsonb; v_paused boolean; v_count integer; v_campaign uuid; v_start date; v_end date; BEGIN
 IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_week IS NULL OR extract(isodow from p_week) <> 1 OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows)>200 THEN RAISE EXCEPTION 'Invalid week or rows'; END IF;
 SELECT version INTO v_version FROM public.allocation_weeks WHERE week_start=p_week FOR UPDATE;
 IF v_version IS NULL OR v_version<>p_version THEN RAISE EXCEPTION 'Allocation changed elsewhere'; END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_creator := (v_row->>'creator_id')::uuid; v_slots := v_row->'slots'; v_paused := COALESCE((v_row->>'paused')::boolean,false);
  SELECT daily_slots INTO v_count FROM public.allocation_creators WHERE creator_id=v_creator;
  IF v_count IS NULL OR (SELECT status FROM public.creators WHERE id=v_creator)<>'active' OR jsonb_typeof(v_slots)<>'array' OR jsonb_array_length(v_slots)<>v_count THEN RAISE EXCEPTION 'Invalid creator slots'; END IF;
  FOR v_campaign IN SELECT value::text::uuid FROM jsonb_array_elements_text(v_slots) WHERE value <> 'null' LOOP
    SELECT c.start_date,c.end_date INTO v_start,v_end FROM public.campaigns c JOIN public.allocation_campaigns ac ON ac.campaign_id=c.id WHERE c.id=v_campaign AND c.status='active';
    IF v_start IS NULL OR v_start>p_week+5 OR (v_end IS NOT NULL AND v_end<p_week) THEN RAISE EXCEPTION 'Campaign not active in week'; END IF;
  END LOOP;
  INSERT INTO public.allocation_slots(week_start,creator_id,slots,paused) VALUES(p_week,v_creator,v_slots,v_paused) ON CONFLICT(week_start,creator_id) DO UPDATE SET slots=excluded.slots,paused=excluded.paused;
 END LOOP;
 UPDATE public.allocation_weeks SET residual_auto=p_auto,version=version+1 WHERE week_start=p_week RETURNING version INTO v_version;
 RETURN v_version;
END $$;
REVOKE ALL ON FUNCTION public.save_allocation_week(date,integer,boolean,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_allocation_week(date,integer,boolean,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.open_allocation_week(p_week date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_prev date; BEGIN
 IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_week IS NULL OR extract(isodow from p_week)<>1 THEN RAISE EXCEPTION 'Invalid week'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('allocation-week'),hashtext(p_week::text));
 IF EXISTS(SELECT 1 FROM public.allocation_weeks WHERE week_start=p_week) THEN RETURN; END IF;
 SELECT max(week_start) INTO v_prev FROM public.allocation_weeks WHERE week_start<p_week;
 INSERT INTO public.allocation_weeks(week_start,residual_auto) VALUES(p_week,COALESCE((SELECT residual_auto FROM public.allocation_weeks WHERE week_start=v_prev),true));
 IF v_prev IS NOT NULL THEN
  INSERT INTO public.allocation_slots(week_start,creator_id,slots,paused)
  SELECT p_week,s.creator_id,(SELECT jsonb_agg(CASE WHEN el.value='null'::jsonb OR EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=(el.value#>>'{}')::uuid AND c.status='active' AND c.start_date<=p_week+5 AND (c.end_date IS NULL OR c.end_date>=p_week)) THEN el.value ELSE 'null'::jsonb END ORDER BY el.ordinality) FROM jsonb_array_elements(s.slots) WITH ORDINALITY AS el(value,ordinality)),s.paused
  FROM public.allocation_slots s WHERE s.week_start=v_prev AND EXISTS(SELECT 1 FROM public.allocation_creators ac JOIN public.creators cr ON cr.id=ac.creator_id WHERE ac.creator_id=s.creator_id AND cr.status='active');
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.open_allocation_week(date) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.open_allocation_week(date) TO authenticated,service_role;
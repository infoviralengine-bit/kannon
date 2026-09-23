CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  status text NOT NULL DEFAULT 'lead',
  stage text NOT NULL DEFAULT 'nuova',
  previous_stage text,
  temperature text,
  source_channel text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deal_type text,
  deal_fixed numeric(10,2),
  deal_cpm numeric(10,2),
  deal_estimated_views bigint,
  deal_performance_pct numeric(5,2),
  deal_performance_note text,
  estimated_monthly_value numeric(10,2),
  next_step text,
  next_step_date date,
  lost_reason text,
  lost_at timestamptz,
  website text,
  sector text,
  notes text,
  client_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  app_name text,
  app_store_url text,
  play_store_url text,
  country text,
  growth_stage text,
  lost_note text,
  last_contact_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_status_check CHECK (status IN ('lead','cliente','ex_cliente')),
  CONSTRAINT companies_stage_check CHECK (stage IN ('nuova','contattata','ha_risposto','call_fissata','call_fatta','proposta_inviata','trattativa','vinto','perso')),
  CONSTRAINT companies_prev_stage_check CHECK (previous_stage IS NULL OR previous_stage IN ('nuova','contattata','ha_risposto','call_fissata','call_fatta','proposta_inviata','trattativa','vinto','perso')),
  CONSTRAINT companies_temperature_check CHECK (temperature IS NULL OR temperature IN ('caldo','tiepido','freddo')),
  CONSTRAINT companies_deal_type_check CHECK (deal_type IS NULL OR deal_type IN ('fisso_cpm','fisso_performance','solo_cpm','solo_fisso')),
  CONSTRAINT companies_growth_stage_check CHECK (growth_stage IS NULL OR growth_stage IN ('pre_lancio','early','scaling','consolidata'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

CREATE TABLE IF NOT EXISTS public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role_title text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_contacts TO authenticated;
GRANT ALL ON public.company_contacts TO service_role;
ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage company contacts" ON public.company_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

CREATE TABLE IF NOT EXISTS public.company_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'nota' CHECK (type IN ('chiamata','email','incontro','messaggio','nota','cambio_stadio','sistema')),
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  direction text CONSTRAINT company_activities_direction_check CHECK (direction IS NULL OR direction IN ('inviata','ricevuta')),
  summary text,
  full_text text,
  participants text,
  outcome text,
  objections text,
  next_steps text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_activities TO authenticated;
GRANT ALL ON public.company_activities TO service_role;
ALTER TABLE public.company_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage company activities" ON public.company_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

CREATE TABLE IF NOT EXISTS public.company_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  due_date date,
  due_time time,
  task_type text,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_next_step boolean NOT NULL DEFAULT false,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_tasks TO authenticated;
GRANT ALL ON public.company_tasks TO service_role;
ALTER TABLE public.company_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage company tasks" ON public.company_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

CREATE TABLE IF NOT EXISTS public.onboarding_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  due_days integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_template_steps TO authenticated;
GRANT ALL ON public.onboarding_template_steps TO service_role;
ALTER TABLE public.onboarding_template_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage onboarding template" ON public.onboarding_template_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

CREATE TABLE IF NOT EXISTS public.company_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  due_date date,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_onboarding_steps TO authenticated;
GRANT ALL ON public.company_onboarding_steps TO service_role;
ALTER TABLE public.company_onboarding_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage company onboarding steps" ON public.company_onboarding_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text,
  size_bytes bigint,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'da_ricevere' CONSTRAINT company_documents_direction_check CHECK (direction IN ('da_inviare','da_ricevere')),
  doc_type text NOT NULL DEFAULT 'altro' CONSTRAINT company_documents_type_check CHECK (doc_type IN ('contratto','fattura','nda','asset','accessi','brief','report','altro')),
  due_date date,
  status text NOT NULL DEFAULT 'in_attesa' CONSTRAINT company_documents_status_check CHECK (status IN ('in_attesa','fatto')),
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage company documents" ON public.company_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

CREATE TABLE IF NOT EXISTS public.company_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_notes TO authenticated;
GRANT ALL ON public.company_notes TO service_role;
ALTER TABLE public.company_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage company notes" ON public.company_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role));

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS campaigns_company_id_idx ON public.campaigns(company_id);
CREATE INDEX IF NOT EXISTS company_activities_company_idx ON public.company_activities(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS company_tasks_due_idx ON public.company_tasks(is_done, due_date);
CREATE INDEX IF NOT EXISTS company_notes_company_idx ON public.company_notes(company_id);

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_contacts_updated_at BEFORE UPDATE ON public.company_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_tasks_updated_at BEFORE UPDATE ON public.company_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER onboarding_template_steps_updated_at BEFORE UPDATE ON public.onboarding_template_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_onboarding_steps_updated_at BEFORE UPDATE ON public.company_onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_company_documents_updated_at BEFORE UPDATE ON public.company_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_notes_updated_at BEFORE UPDATE ON public.company_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_company_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.temperature IS DISTINCT FROM OLD.temperature THEN
    INSERT INTO public.company_activities (company_id, type, summary, body, author_id)
    VALUES (NEW.id, 'sistema',
      'Temperatura: ' || COALESCE(OLD.temperature,'-') || ' -> ' || COALESCE(NEW.temperature,'-'),
      NULL, auth.uid());
  END IF;
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.previous_stage := OLD.stage;
    IF NEW.stage = 'perso' THEN
      NEW.lost_at := now();
    ELSIF OLD.stage = 'perso' THEN
      NEW.lost_at := NULL;
    END IF;
    IF NEW.stage = 'vinto' AND NEW.status = 'lead' THEN
      NEW.status := 'cliente';
    END IF;
    INSERT INTO public.company_activities (company_id, type, summary, author_id)
    VALUES (NEW.id, 'cambio_stadio',
      'Stadio: ' || OLD.stage || ' -> ' || NEW.stage ||
      COALESCE(CASE WHEN NEW.stage = 'perso' AND NEW.lost_reason IS NOT NULL THEN ' (' || NEW.lost_reason || ')' ELSE NULL END, ''),
      auth.uid());
    IF NEW.stage = 'vinto' AND OLD.stage <> 'vinto'
       AND NOT EXISTS (SELECT 1 FROM public.company_onboarding_steps WHERE company_id = NEW.id) THEN
      INSERT INTO public.company_onboarding_steps (company_id, title, description, position, due_date)
      SELECT NEW.id, t.title, t.description, t.position, (current_date + t.due_days)
      FROM public.onboarding_template_steps t
      WHERE t.is_active
      ORDER BY t.position;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_company_stage_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER companies_stage_change BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_company_stage_change();

CREATE OR REPLACE FUNCTION public.sync_campaign_client_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT name INTO v_name FROM public.companies WHERE id = NEW.company_id;
    IF v_name IS NOT NULL THEN NEW.client_name := v_name; END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_campaign_client_name() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER campaigns_sync_client_name BEFORE INSERT OR UPDATE OF company_id ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_client_name();

CREATE OR REPLACE FUNCTION public.propagate_company_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.campaigns SET client_name = NEW.name WHERE company_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.propagate_company_name() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER companies_propagate_name AFTER UPDATE OF name ON public.companies FOR EACH ROW EXECUTE FUNCTION public.propagate_company_name();

CREATE OR REPLACE FUNCTION public.refresh_company_client_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_active int;
BEGIN
  v_company := COALESCE(NEW.company_id, OLD.company_id);
  IF v_company IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT count(*) INTO v_active FROM public.campaigns WHERE company_id = v_company AND status = 'active';
  IF v_active > 0 THEN
    UPDATE public.companies SET status = 'cliente' WHERE id = v_company AND status IN ('lead','ex_cliente');
  ELSE
    UPDATE public.companies SET status = 'ex_cliente' WHERE id = v_company AND status = 'cliente';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE ALL ON FUNCTION public.refresh_company_client_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER campaigns_refresh_company_status AFTER INSERT OR UPDATE OF status, company_id OR DELETE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.refresh_company_client_status();

CREATE OR REPLACE FUNCTION public.touch_company_last_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type IN ('chiamata','email','incontro','messaggio','linkedin','whatsapp') THEN
    UPDATE public.companies
    SET last_contact_at = GREATEST(COALESCE(last_contact_at, NEW.occurred_at), NEW.occurred_at)
    WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.touch_company_last_contact() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_touch_company_last_contact AFTER INSERT ON public.company_activities
FOR EACH ROW EXECUTE FUNCTION public.touch_company_last_contact();

INSERT INTO public.onboarding_template_steps (title, description, position, due_days, is_active) VALUES
  ('Kickoff call fatta', NULL, 1, 0, true),
  ('Contratto firmato ricevuto', NULL, 2, 2, true),
  ('Asset del brand ricevuti', 'Logo, linee guida, tono di voce', 3, 3, true),
  ('Accessi ricevuti, se previsti', NULL, 4, 5, true),
  ('Account del portale cliente creato', NULL, 5, 3, true),
  ('Campagna creata nel Hub', NULL, 6, 3, true),
  ('Creator assegnati', NULL, 7, 7, true),
  ('Brief della prima settimana approvati', NULL, 8, 7, true),
  ('Prima fattura emessa', NULL, 9, 7, true),
  ('Primo report inviato', NULL, 10, 30, true);

CREATE POLICY "Staff can read company documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'company-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)));
CREATE POLICY "Staff can upload company documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)));
CREATE POLICY "Staff can update company documents" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)));
CREATE POLICY "Staff can delete company documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)));

CREATE OR REPLACE FUNCTION public.get_company_payments(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'due_date' DESC), '[]'::jsonb) INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', p.id, 'campaign_name', c.name, 'cycle_number', p.cycle_number,
      'due_date', p.due_date, 'amount', COALESCE(p.amount_override, p.total_amount),
      'is_paid', p.is_paid, 'paid_at', p.paid_at, 'invoice_number', p.invoice_number
    ) AS x
    FROM public.client_payments p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE c.company_id = p_company_id
  ) s;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.get_company_payments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_payments(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_channel_stats(p_period text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from timestamptz;
  v_order text[] := ARRAY['nuova','contattata','ha_risposto','call_fissata','call_fatta','proposta_inviata','trattativa','vinto'];
  v_res jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_from := CASE p_period
    WHEN '30d' THEN now() - interval '30 days'
    WHEN '90d' THEN now() - interval '90 days'
    WHEN 'year' THEN date_trunc('year', now())
    ELSE '-infinity'::timestamptz END;
  WITH reached AS (
    SELECT c.id, COALESCE(NULLIF(c.source_channel,''),'Non indicato') AS channel,
      c.stage, c.estimated_monthly_value,
      GREATEST(
        COALESCE(array_position(v_order, c.stage),0),
        COALESCE(array_position(v_order, c.previous_stage),0),
        COALESCE((SELECT max(array_position(v_order, split_part(split_part(a.summary,' -> ',2),' (',1)))
                  FROM company_activities a WHERE a.company_id=c.id AND a.type='cambio_stadio'),0)
      ) AS rank
    FROM companies c WHERE c.created_at >= v_from
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.leads DESC), '[]'::jsonb) INTO v_res FROM (
    SELECT channel,
      count(*)::int AS leads,
      count(*) FILTER (WHERE rank >= 5)::int AS calls,
      count(*) FILTER (WHERE rank >= 6)::int AS proposals,
      count(*) FILTER (WHERE stage='vinto' OR rank >= 8)::int AS won,
      COALESCE(sum(estimated_monthly_value) FILTER (WHERE stage='vinto' OR rank>=8),0) AS won_value
    FROM reached GROUP BY channel
  ) t;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.get_channel_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_channel_stats(text) TO authenticated;
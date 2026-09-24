CREATE TABLE public.company_timeline_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_timeline_order_item_type_valid CHECK (item_type IN ('activity', 'document', 'task', 'note')),
  CONSTRAINT company_timeline_order_unique_item UNIQUE (company_id, item_type, item_id),
  CONSTRAINT company_timeline_order_unique_position UNIQUE (company_id, position) DEFERRABLE INITIALLY DEFERRED
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_timeline_order TO authenticated;
GRANT ALL ON public.company_timeline_order TO service_role;

ALTER TABLE public.company_timeline_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view timeline order"
ON public.company_timeline_order
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'team'::public.app_role)
);

CREATE POLICY "Staff can create timeline order"
ON public.company_timeline_order
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'team'::public.app_role)
);

CREATE POLICY "Staff can update timeline order"
ON public.company_timeline_order
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'team'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'team'::public.app_role)
);

CREATE POLICY "Staff can delete timeline order"
ON public.company_timeline_order
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'team'::public.app_role)
);

CREATE TRIGGER set_company_timeline_order_updated_at
BEFORE UPDATE ON public.company_timeline_order
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX company_timeline_order_company_position_idx
ON public.company_timeline_order(company_id, position);
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { CompanyStage, CompanyStatus, DealType } from "@/lib/companies";

const db = supabase as any;

export type Company = {
  id: string;
  name: string;
  legal_name: string | null;
  status: CompanyStatus;
  stage: CompanyStage;
  previous_stage: CompanyStage | null;
  temperature: string | null;
  source_channel: string | null;
  owner_id: string | null;
  deal_type: DealType | null;
  deal_fixed: number | null;
  deal_cpm: number | null;
  deal_estimated_views: number | null;
  deal_performance_pct: number | null;
  deal_performance_note: string | null;
  estimated_monthly_value: number | null;
  next_step: string | null;
  next_step_date: string | null;
  lost_reason: string | null;
  lost_note: string | null;
  lost_at: string | null;
  website: string | null;
  sector: string | null;
  app_name: string | null;
  app_store_url: string | null;
  play_store_url: string | null;
  country: string | null;
  growth_stage: string | null;
  last_contact_at: string | null;
  notes: string | null;
  client_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyContact = {
  id: string;
  company_id: string;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

export type CompanyActivity = {
  id: string;
  company_id: string;
  type: string;
  direction: string | null;
  summary: string | null;
  full_text: string | null;
  body: string | null;
  occurred_at: string;
  author_id: string | null;
  participants?: string | null;
  outcome?: string | null;
  objections?: string | null;
  next_steps?: string | null;
};

export type CompanyTask = {
  id: string;
  company_id: string | null;
  title: string;
  notes: string | null;
  task_type: string | null;
  due_date: string | null;
  due_time: string | null;
  assignee_id: string | null;
  is_next_step: boolean;
  is_done: boolean;
  done_at: string | null;
};

export type CompanyOnboardingStep = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
};

export type CompanyDocument = {
  id: string;
  company_id: string;
  name: string;
  direction: string;
  doc_type: string;
  status: string;
  due_date: string | null;
  link_url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

export type CompanyCampaign = {
  id: string;
  name: string;
  status: string;
  start_date: string;
  client_fixed: number | null;
  client_cpm: number | null;
};

export type OnboardingTemplateStep = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  due_days: number;
  is_active: boolean;
};

/* ------------------------------ queries ------------------------------ */

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await db.from("companies").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });
}

/** Opzioni per il selettore cliente nel form campagna. */
export function useCompanyOptions() {
  return useQuery({
    queryKey: ["company-options"],
    queryFn: async () => {
      const { data, error } = await db
        .from("companies")
        .select("id, name, status")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Company, "id" | "name" | "status">[];
    },
  });
}

/** Riepilogo per la pagina Clienti: campagne, task aperti, documenti, onboarding. */
export function useClientsOverview() {
  return useQuery({
    queryKey: ["clients-overview"],
    queryFn: async () => {
      const [companies, campaigns, tasks, docs, steps] = await Promise.all([
        db.from("companies").select("*").in("status", ["cliente", "ex_cliente"]).order("name"),
        db.from("campaigns").select("id, name, status, company_id").not("company_id", "is", null),
        db.from("company_tasks").select("id, company_id").eq("is_done", false),
        db.from("company_documents").select("id, company_id, status"),
        db.from("company_onboarding_steps").select("id, company_id, is_done"),
      ]);
      if (companies.error) throw companies.error;

      const list = (companies.data ?? []) as Company[];
      return list.map((c) => {
        const camps = (campaigns.data ?? []).filter((x: any) => x.company_id === c.id);
        const stepRows = (steps.data ?? []).filter((x: any) => x.company_id === c.id);
        return {
          company: c,
          activeCampaigns: camps.filter((x: any) => x.status === "active").length,
          totalCampaigns: camps.length,
          openTasks: (tasks.data ?? []).filter((x: any) => x.company_id === c.id).length,
          pendingDocs: (docs.data ?? []).filter(
            (x: any) => x.company_id === c.id && x.status === "in_attesa",
          ).length,
          onboardingDone: stepRows.filter((x: any) => x.is_done).length,
          onboardingTotal: stepRows.length,
        };
      });
    },
  });
}

export function useCompany(companyId: string | null) {
  return useQuery({
    queryKey: ["company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [company, contacts, activities, tasks, steps, docs, campaigns] = await Promise.all([
        db.from("companies").select("*").eq("id", companyId).single(),
        db.from("company_contacts").select("*").eq("company_id", companyId).order("is_primary", { ascending: false }),
        db.from("company_activities").select("*").eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(200),
        db.from("company_tasks").select("*").eq("company_id", companyId).order("due_date", { ascending: true }),
        db.from("company_onboarding_steps").select("*").eq("company_id", companyId).order("position"),
        db.from("company_documents").select("*").eq("company_id", companyId).order("due_date", { ascending: true }),
        db.from("campaigns").select("id, name, status, start_date, client_fixed, client_cpm").eq("company_id", companyId).order("start_date", { ascending: false }),
      ]);
      if (company.error) throw company.error;
      return {
        company: company.data as Company,
        contacts: (contacts.data ?? []) as CompanyContact[],
        activities: (activities.data ?? []) as CompanyActivity[],
        tasks: (tasks.data ?? []) as CompanyTask[],
        onboardingSteps: (steps.data ?? []) as CompanyOnboardingStep[],
        documents: (docs.data ?? []) as CompanyDocument[],
        campaigns: (campaigns.data ?? []) as CompanyCampaign[],
      };
    },
  });
}

/** Pagamenti del cliente, sola lettura e solo admin (bloccato lato database). */
export function useCompanyPayments(companyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["company-payments", companyId],
    enabled: !!companyId && enabled,
    queryFn: async () => {
      const { data, error } = await db.rpc("get_company_payments", { p_company_id: companyId });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        campaign_name: string;
        cycle_number: number;
        due_date: string;
        amount: number;
        is_paid: boolean;
        paid_at: string | null;
        invoice_number: string | null;
      }[];
    },
  });
}

/** Agenda: cose da fare aperte, con il nome dell'azienda. */
export function useAgendaTasks() {
  return useQuery({
    queryKey: ["company-tasks-agenda"],
    queryFn: async () => {
      const { data, error } = await db
        .from("company_tasks")
        .select("*, companies(id, name)")
        .eq("is_done", false)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (CompanyTask & { companies: { id: string; name: string } | null })[];
    },
  });
}

export function useStaffProfiles() {
  return useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data: roles, error } = await db
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "team"]);
      if (error) throw error;
      const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
      if (!ids.length) return [] as { id: string; full_name: string | null }[];
      const { data: profiles } = await db
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return (profiles ?? []) as { id: string; full_name: string | null }[];
    },
  });
}

/* ----------------------------- mutations ----------------------------- */

function useInvalidateCompanies() {
  const qc = useQueryClient();
  return (companyId?: string | null) => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["company-options"] });
    qc.invalidateQueries({ queryKey: ["clients-overview"] });
    qc.invalidateQueries({ queryKey: ["company-tasks-agenda"] });
    if (companyId) qc.invalidateQueries({ queryKey: ["company", companyId] });
  };
}

export function useSaveCompany() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<Company> }) => {
      if (id) {
        const { error } = await db.from("companies").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: session } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("companies")
        .insert({ ...values, created_by: session.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id, vars) => {
      invalidate(id);
      toast({ title: vars.id ? "Azienda aggiornata" : "Azienda creata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateCompanyStage() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({
      id, stage, lostReason, lostNote, nextStep, nextStepDate,
    }: {
      id: string;
      stage: CompanyStage;
      lostReason?: string;
      lostNote?: string;
      nextStep?: string | null;
      nextStepDate?: string | null;
    }) => {
      const values: Record<string, unknown> = { stage };
      if (stage === "perso") {
        values.lost_reason = lostReason ?? null;
        values.lost_note = lostNote ?? null;
        values.next_step = null;
        values.next_step_date = null;
      } else {
        if (nextStep !== undefined) values.next_step = nextStep;
        if (nextStepDate !== undefined) values.next_step_date = nextStepDate;
      }
      const { error } = await db.from("companies").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidate(vars.id);
      toast({ title: "Stadio aggiornato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

/** "Fatto, qual è il prossimo?": registra l'attività e imposta il passo successivo. */
export function useCompleteNextStep() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({
      companyId, doneSummary, activityType, nextStep, nextStepDate,
    }: {
      companyId: string;
      doneSummary: string;
      activityType: string;
      nextStep: string | null;
      nextStepDate: string | null;
    }) => {
      const { data: session } = await supabase.auth.getUser();
      const { error: actErr } = await db.from("company_activities").insert({
        company_id: companyId,
        type: activityType,
        summary: doneSummary,
        author_id: session.user?.id ?? null,
      });
      if (actErr) throw actErr;
      const { error } = await db
        .from("companies")
        .update({ next_step: nextStep, next_step_date: nextStepDate })
        .eq("id", companyId);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Prossimo passo aggiornato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteCompany() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Azienda eliminata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useSaveContact() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<CompanyContact> }) => {
      if (id) {
        const { error } = await db.from("company_contacts").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("company_contacts").insert(values);
        if (error) throw error;
      }
      return values.company_id ?? null;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Contatto salvato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteContact() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await db.from("company_contacts").delete().eq("id", id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Contatto eliminato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useAddActivity() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({
      companyId, type, direction, summary, fullText, occurredAt,
    }: {
      companyId: string;
      type: string;
      direction?: string | null;
      summary: string;
      fullText?: string | null;
      occurredAt?: string | null;
    }) => {
      const { data: session } = await supabase.auth.getUser();
      const { error } = await db.from("company_activities").insert({
        company_id: companyId,
        type,
        direction: direction ?? null,
        summary,
        full_text: fullText ?? null,
        occurred_at: occurredAt || new Date().toISOString(),
        author_id: session.user?.id ?? null,
      });
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Attività registrata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useSaveTask() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<CompanyTask> }) => {
      if (id) {
        const { error } = await db.from("company_tasks").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { data: session } = await supabase.auth.getUser();
        const { error } = await db.from("company_tasks").insert({
          ...values,
          created_by: session.user?.id ?? null,
        });
        if (error) throw error;
      }
      return values.company_id ?? null;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Cosa da fare salvata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useToggleTask() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, isDone, companyId }: { id: string; isDone: boolean; companyId: string | null }) => {
      const { error } = await db
        .from("company_tasks")
        .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => invalidate(companyId),
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteTask() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string | null }) => {
      const { error } = await db.from("company_tasks").delete().eq("id", id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Cosa da fare eliminata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useToggleOnboardingStep() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, isDone, companyId }: { id: string; isDone: boolean; companyId: string }) => {
      const { error } = await db
        .from("company_onboarding_steps")
        .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => invalidate(companyId),
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

/* ----------------------------- documenti ----------------------------- */

const BUCKET = "company-documents";

/** Crea o aggiorna la riga di un documento atteso (da inviare o da ricevere). */
export function useSaveDocument() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<CompanyDocument> }) => {
      if (id) {
        const { error } = await db.from("company_documents").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { data: session } = await supabase.auth.getUser();
        const { error } = await db
          .from("company_documents")
          .insert({ ...values, uploaded_by: session.user?.id ?? null });
        if (error) throw error;
      }
      return values.company_id ?? null;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Documento salvato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useUploadDocument() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({
      companyId, file, documentId, direction, docType,
    }: {
      companyId: string;
      file: File;
      documentId?: string;
      direction?: string;
      docType?: string;
    }) => {
      const path = `${companyId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const payload = {
        name: file.name,
        storage_path: path,
        size_bytes: file.size,
        mime_type: file.type || null,
        status: "fatto",
      };
      if (documentId) {
        const { error } = await db.from("company_documents").update(payload).eq("id", documentId);
        if (error) throw error;
      } else {
        const { data: session } = await supabase.auth.getUser();
        const { error } = await db.from("company_documents").insert({
          ...payload,
          company_id: companyId,
          direction: direction ?? "da_ricevere",
          doc_type: docType ?? "altro",
          uploaded_by: session.user?.id ?? null,
        });
        if (error) throw error;
      }
      return companyId;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "File caricato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteDocument() {
  const { toast } = useToast();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: async ({ id, path, companyId }: { id: string; path: string | null; companyId: string }) => {
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      const { error } = await db.from("company_documents").delete().eq("id", id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      invalidate(companyId);
      toast({ title: "Documento eliminato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export async function openDocument(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

/* --------------------- modello checklist onboarding --------------------- */

export function useOnboardingTemplate() {
  return useQuery({
    queryKey: ["onboarding-template"],
    queryFn: async () => {
      const { data, error } = await db
        .from("onboarding_template_steps")
        .select("*")
        .order("position");
      if (error) throw error;
      return (data ?? []) as OnboardingTemplateStep[];
    },
  });
}

export function useSaveTemplateStep() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<OnboardingTemplateStep> }) => {
      if (id) {
        const { error } = await db.from("onboarding_template_steps").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("onboarding_template_steps").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-template"] });
      toast({ title: "Modello aggiornato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteTemplateStep() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("onboarding_template_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-template"] });
      toast({ title: "Passaggio eliminato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

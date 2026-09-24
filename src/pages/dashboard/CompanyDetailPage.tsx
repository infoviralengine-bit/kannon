import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, FilePlus, ListTodo, Pencil, Phone, RotateCcw, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  PIPELINE_STAGES, STAGE_LABEL, STATUS_BADGE, STATUS_LABEL, TEMPERATURE_BADGE, TEMPERATURE_LABEL,
  formatDateIt, type CompanyStage, type CompanyStatus, type Temperature,
} from "@/lib/companies";
import { formatCurrency } from "@/lib/format";
import { useCompany, useSaveCompany, useStaffProfiles, useUpdateCompanyStage } from "@/hooks/useCompanies";
import { useCompanyNotes } from "@/hooks/useCompanyNotes";
import { NextStepCard } from "@/components/companies/NextStepCard";
import { CompanyFormDialog } from "@/components/companies/CompanyFormDialog";
import { StageMoveDialog } from "@/components/companies/StageMoveDialog";
import { OverviewTab } from "@/components/companies/tabs/OverviewTab";
import { TasksTab } from "@/components/companies/tabs/TasksTab";
import { DocumentsTab } from "@/components/companies/tabs/DocumentsTab";
import { OnboardingTab } from "@/components/companies/tabs/OnboardingTab";
import { CampaignsTab } from "@/components/companies/tabs/CampaignsTab";
import { PaymentsTab } from "@/components/companies/tabs/PaymentsTab";
import { Section, SectionNav } from "@/components/companies/detail/Section";
import { TimelineSection } from "@/components/companies/detail/TimelineSection";
import { CallNotesSection } from "@/components/companies/detail/CallNotesSection";
import { NotesSection } from "@/components/companies/detail/NotesSection";
import { useI18n } from "@/i18n";

const go = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 50);

export default function CompanyDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data, isLoading } = useCompany(id ?? null);
  const { data: notes = [] } = useCompanyNotes(id ?? null);
  const { data: staff = [] } = useStaffProfiles();
  const updateStage = useUpdateCompanyStage();
  const saveCompany = useSaveCompany();
  const [editOpen, setEditOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [move, setMove] = useState<CompanyStage | null>(null);

  const authorName = useCallback(
    (uid: string | null) => (uid ? staff.find((p) => p.id === uid)?.full_name ?? undefined : undefined), [staff]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { company, contacts, activities, tasks, onboardingSteps, documents, campaigns } = data;
  const isClient = company.status !== "lead";
  const isAdmin = role === "admin";
  const ownerName = staff.find((p) => p.id === company.owner_id)?.full_name ?? "-";
  const primary = contacts[0];
  const displayName = company.app_name || company.name;
  const stageIdx = PIPELINE_STAGES.indexOf(company.stage as CompanyStage);
  const nextStage = stageIdx >= 0 && stageIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIdx + 1] : null;
  const calls = activities.filter((a) => a.type === "chiamata" || a.type === "incontro");
  const openTasks = tasks.filter((t) => !t.is_done).length;
  const temp = company.temperature as Temperature | null;

  const nav = [
    { id: "riepilogo", label: t("Riepilogo") },
    { id: "cronologia", label: t("Cronologia") },
    { id: "call", label: t("Call"), count: calls.length },
    { id: "appunti", label: t("Appunti"), count: notes.length },
    { id: "file", label: t("File"), count: documents.length },
    { id: "task", label: t("Da fare"), count: openTasks },
    ...(isClient ? [{ id: "onboarding", label: t("Onboarding") }, { id: "campagne", label: t("Campagne"), count: campaigns.length }] : []),
    ...(isClient && isAdmin ? [{ id: "pagamenti", label: t("Pagamenti") }] : []),
  ];

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-border/50 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label={t("Indietro")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-semibold">{displayName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={STATUS_BADGE[company.status as CompanyStatus]}>
                  {t(STATUS_LABEL[company.status as CompanyStatus])}
                </Badge>
                {company.status !== "cliente" && (
                  <Badge variant="outline" className="border-accent/40 text-accent">{t(STAGE_LABEL[company.stage as CompanyStage])}</Badge>
                )}
                {temp && company.status !== "cliente" && <Badge variant="outline" className={TEMPERATURE_BADGE[temp]}>{t(TEMPERATURE_LABEL[temp])}</Badge>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {primary ? `${primary.full_name}${primary.role_title ? ` (${primary.role_title})` : ""}` : t("Nessun referente")}
                {" · "}{t("Responsabile: {name}", { name: ownerName })}
                {" · "}{t("Valore: {value}", { value: company.estimated_monthly_value ? formatCurrency(company.estimated_monthly_value) : "-" })}
                {" · "}{t("Ultimo contatto: {date}", { date: formatDateIt(company.last_contact_at) })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {company.status === "lead" && (
              company.stage === "perso" ? (
                <Button variant="outline" onClick={() => updateStage.mutate({
                  id: company.id, stage: (company.previous_stage ?? "nuova") as CompanyStage })}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("Riapri in {stage}", { stage: t(STAGE_LABEL[(company.previous_stage ?? "nuova") as CompanyStage]) })}
                </Button>
              ) : (
                <>
                  {nextStage && (
                    <Button variant="outline" onClick={() => setMove(nextStage)}>
                      <ArrowDown className="mr-1 h-4 w-4 text-green-600" /> {t(STAGE_LABEL[nextStage])}
                    </Button>
                  )}
                  <Button variant="outline" className="hover:border-destructive hover:text-destructive"
                    onClick={() => setMove("perso")}>{t("Persa")}</Button>
                </>
              )
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> {t("Modifica")}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/40 pt-3">
          <Button size="sm" variant="secondary" onClick={() => { setCallOpen(true); go("call"); }}>
            <Phone className="mr-1.5 h-3.5 w-3.5" /> {t("Call")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setNoteOpen(true); go("appunti"); }}>
            <StickyNote className="mr-1.5 h-3.5 w-3.5" /> {t("Appunto")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => go("file")}>
            <FilePlus className="mr-1.5 h-3.5 w-3.5" /> {t("File")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => go("task")}>
            <ListTodo className="mr-1.5 h-3.5 w-3.5" /> {t("Task")}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <SectionNav items={nav} />
        <div className="space-y-4">
          {company.stage !== "perso" && <NextStepCard company={company} />}

          <Section id="riepilogo" title={t("Riepilogo")}>
            <OverviewTab company={company} contacts={contacts} ownerName={ownerName} />
          </Section>
          <Section id="cronologia" title={t("Cronologia")}>
            <TimelineSection activities={activities} documents={documents} tasks={tasks} notes={notes} authorName={authorName} />
          </Section>
          <Section id="call" title={t("Note call")} count={calls.length}
            action={!callOpen && <Button size="sm" variant="outline" onClick={() => setCallOpen(true)}>{t("Nuova call")}</Button>}>
            <CallNotesSection companyId={company.id} activities={activities} formOpen={callOpen} setFormOpen={setCallOpen}
              authorName={authorName}
              onUpdateNextStep={(text) => saveCompany.mutate({ id: company.id, values: { next_step: text } })} />
          </Section>
          <Section id="appunti" title={t("Appunti")} count={notes.length}
            action={!noteOpen && <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>{t("Nuovo appunto")}</Button>}>
            <NotesSection companyId={company.id} notes={notes} formOpen={noteOpen} setFormOpen={setNoteOpen} authorName={authorName} />
          </Section>
          <Section id="file" title={t("File e documenti")} count={documents.length}>
            <DocumentsTab companyId={company.id} documents={documents} />
          </Section>
          <Section id="task" title={t("Da fare")} count={openTasks}>
            <TasksTab companyId={company.id} tasks={tasks} />
          </Section>
          {isClient && (
            <>
              <Section id="onboarding" title={t("Onboarding")}>
                <OnboardingTab companyId={company.id} steps={onboardingSteps} />
              </Section>
              <Section id="campagne" title={t("Campagne")} count={campaigns.length}>
                <CampaignsTab campaigns={campaigns} />
              </Section>
            </>
          )}
          {isClient && isAdmin && (
            <Section id="pagamenti" title={t("Pagamenti")}>
              <PaymentsTab companyId={company.id} />
            </Section>
          )}
        </div>
      </div>

      <CompanyFormDialog open={editOpen} onOpenChange={setEditOpen} company={company} />
      <StageMoveDialog company={move ? company : null} targetStage={move} onClose={() => setMove(null)} />
    </div>
  );
}

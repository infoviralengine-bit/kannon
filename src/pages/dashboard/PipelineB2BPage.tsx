import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CalendarCheck, Kanban, List, Plus, Search, Target } from "lucide-react";
import { PipelineRadar } from "@/components/companies/PipelineRadar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SOURCE_CHANNELS, TEMPERATURES, TEMPERATURE_LABEL, daysSince, isOverdue, isToday,
  type CompanyStage, type Temperature,
} from "@/lib/companies";
import { useCompanies, useStaffProfiles, type Company } from "@/hooks/useCompanies";
import { PipelineKanban } from "@/components/companies/PipelineKanban";
import { PipelineTable } from "@/components/companies/PipelineTable";
import { CompanyFormDialog } from "@/components/companies/CompanyFormDialog";
import { StageMoveDialog } from "@/components/companies/StageMoveDialog";

const ALL = "__all__";

const SORT_LABELS: Record<string, string> = {
  recenti: "Aggiornate di recente",
  valore: "Valore più alto",
  scadenza: "Prossimo passo",
  nome: "Nome",
};

const SORT_SHORT: Record<string, string> = {
  recenti: "Recenti",
  valore: "Valore",
  scadenza: "Scadenza",
  nome: "Nome",
};

const STAGE_WEIGHT: Record<CompanyStage, number> = {
  nuova: 0.1,
  contattata: 0.15,
  ha_risposto: 0.25,
  call_fissata: 0.4,
  call_fatta: 0.55,
  proposta_inviata: 0.7,
  trattativa: 0.85,
  vinto: 1,
  perso: 0,
};

export default function PipelineB2BPage() {
  const navigate = useNavigate();
  const { data: companies = [], isLoading } = useCompanies();
  const { data: staff = [] } = useStaffProfiles();

  const [view, setView] = useState<"kanban" | "tabella" | "radar">("kanban");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState(ALL);
  const [channel, setChannel] = useState(() => new URLSearchParams(window.location.search).get("channel") ?? ALL);
  const [temperature, setTemperature] = useState(ALL);
  const [sort, setSort] = useState("recenti");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyIdle, setOnlyIdle] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ company: Company; stage: CompanyStage } | null>(null);

  // Le lead vinte diventano "cliente" ma restano visibili nella fase Vinta della pipeline
  const leads = useMemo(
    () => companies.filter((c) => c.status === "lead" || c.stage === "vinto"),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = leads.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !(c.app_name ?? "").toLowerCase().includes(q)) return false;
      if (owner !== ALL && c.owner_id !== owner) return false;
      if (channel !== ALL && c.source_channel !== channel) return false;
      if (temperature !== ALL && c.temperature !== temperature) return false;
      if (onlyOverdue && !isOverdue(c.next_step_date)) return false;
      if (onlyIdle && (daysSince(c.last_contact_at ?? c.updated_at) ?? 0) < 14) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "valore") return Number(b.estimated_monthly_value ?? 0) - Number(a.estimated_monthly_value ?? 0);
      if (sort === "nome") return a.name.localeCompare(b.name);
      if (sort === "scadenza") return (a.next_step_date ?? "9999").localeCompare(b.next_step_date ?? "9999");
      return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
    });
  }, [leads, search, owner, channel, temperature, onlyOverdue, onlyIdle, sort]);

  const active = filtered.filter((c) => c.stage !== "perso");
  const overdue = active.filter((c) => isOverdue(c.next_step_date)).length;
  const withoutNextStep = active.filter((c) => !c.next_step || !c.next_step_date).length;
  const urgentActions = overdue + withoutNextStep;
  const weightedValue = active.reduce(
    (sum, company) => sum + Number(company.estimated_monthly_value ?? 0) * STAGE_WEIGHT[company.stage],
    0,
  );
  const activitiesToday = active.filter((c) => isToday(c.next_step_date));
  const callsToday = activitiesToday.filter((c) =>
    c.stage === "call_fissata" || (c.next_step ?? "").toLowerCase().includes("call"),
  ).length;
  const followUpsToday = activitiesToday.length - callsToday;

  const ownerName = (id: string | null) => staff.find((p) => p.id === id)?.full_name ?? "-";
  const openCompany = (id: string) => navigate(`/dashboard/clients/${id}`);

  const ownerLabel = owner === ALL ? "Tutti" : ownerName(owner);
  const channelLabel = channel === ALL ? "Tutti" : channel;
  const temperatureLabel = temperature === ALL ? "Tutte" : TEMPERATURE_LABEL[temperature as Temperature];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pipeline B2B</h1>
          <p className="text-xs text-muted-foreground">Le trattative aperte, dallo scouting alla firma.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-border/60 bg-card p-0.5">
            {([
              ["kanban", Kanban, "Fasi"],
              ["tabella", List, "Tabella"],
              ["radar", Target, "Radar"],
            ] as const).map(([v, Icon, label]) => (
              <Button key={v} size="sm" variant={view === v ? "secondary" : "ghost"}
                className={cn("h-8 gap-1.5 px-2.5", view === v && "text-accent")}
                onClick={() => setView(v)} aria-label={`Vista ${label}`}>
                <Icon className="h-4 w-4" /> <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuova lead
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <OperationalCard
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          label="Azioni urgenti"
          value={String(urgentActions).padStart(2, "0")}
          detail={`${overdue} scadute · ${withoutNextStep} senza prossimo passo`}
          urgent={urgentActions > 0}
        />
        <OperationalCard
          label="Valore ponderato"
          value={formatCurrency(weightedValue)}
        />
        <OperationalCard
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          label="Attività oggi"
          value={String(activitiesToday.length).padStart(2, "0")}
          detail={`${callsToday} call fissate · ${followUpsToday} follow-up`}
        />
      </div>

      <div className="rounded-xl border border-border/40 bg-card p-1.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1">
          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-lg border-none bg-surface pl-9 text-sm placeholder:text-muted-foreground/60"
              placeholder="Cerca azienda o app"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-10 w-auto gap-1 rounded-lg border-border/50 bg-surface/60 px-2 text-[13px] hover:bg-surface">
              <span className="text-muted-foreground">Resp.:</span>
              <span className="font-medium">{ownerLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tutti i responsabili</SelectItem>
              {staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "Senza nome"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-10 w-auto gap-1 rounded-lg border-border/50 bg-surface/60 px-2 text-[13px] hover:bg-surface">
              <span className="text-muted-foreground">Canale:</span>
              <span className="font-medium">{channelLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tutti i canali</SelectItem>
              {SOURCE_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={temperature} onValueChange={setTemperature}>
            <SelectTrigger className="h-10 w-auto gap-1 rounded-lg border-border/50 bg-surface/60 px-2 text-[13px] hover:bg-surface">
              <span className="text-muted-foreground">Temp.:</span>
              <span className="font-medium">{temperatureLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tutte</SelectItem>
              {TEMPERATURES.map((t) => <SelectItem key={t} value={t}>{TEMPERATURE_LABEL[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-10 w-auto gap-1 rounded-lg border-border/50 bg-surface/60 px-2 text-[13px] hover:bg-surface">
              <span className="text-muted-foreground">Ordina:</span>
              <span className="font-medium">{SORT_SHORT[sort]}</span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <FilterToggle label="Passo scaduto" active={onlyOverdue} onClick={() => setOnlyOverdue(!onlyOverdue)} />
          <FilterToggle label="Ferme da 14gg" active={onlyIdle} onClick={() => setOnlyIdle(!onlyIdle)} />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : view === "radar" ? (
        <PipelineRadar companies={filtered} onOpenCompany={openCompany} />
      ) : view === "kanban" ? (
        <PipelineKanban
          companies={filtered}
          ownerName={ownerName}
          onOpenCompany={openCompany}
          onRequestStage={(company, stage) => setMoveTarget({ company, stage })}
        />
      ) : (
        <PipelineTable companies={filtered} ownerName={ownerName} onOpenCompany={openCompany} />
      )}

      <CompanyFormDialog open={formOpen} onOpenChange={setFormOpen} company={null} />
      <StageMoveDialog
        company={moveTarget?.company ?? null}
        targetStage={moveTarget?.stage ?? null}
        onClose={() => setMoveTarget(null)}
      />
    </div>
  );
}

function FilterToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium transition-all active:scale-95",
        active
          ? "border-accent/40 bg-surface text-accent"
          : "border-border/50 bg-surface/60 text-foreground hover:bg-surface",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", active ? "animate-pulse bg-accent" : "bg-muted-foreground/30")} />
      {label}
    </button>
  );
}

function OperationalCard({
  icon,
  label,
  value,
  detail,
  urgent = false,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  detail?: string;
  urgent?: boolean;
}) {
  return (
    <Card className="min-h-[92px] shadow-sm">
      <CardContent className="flex h-full min-h-[92px] flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {icon}
            <p className="text-[9px] font-bold uppercase">{label}</p>
          </div>
          <p className={`mt-0.5 text-2xl font-medium tabular-nums ${urgent ? "text-destructive" : "text-foreground"}`}>
            {value}
          </p>
        </div>
        {detail && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {urgent && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
            <p>{detail}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

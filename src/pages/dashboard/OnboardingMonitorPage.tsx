import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { UserPlus, Users, Flame, Rocket, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";

type Phase = "all" | "lead" | "onboarding" | "warmup" | "operativi";

interface CreatorPipelineRow {
  id: string;
  name: string;
  email: string | null;
  phase: "lead" | "onboarding" | "warmup" | "operativi";
  phaseLabel: string;
  createdAt: string;
  accountCount: number;
  warmupProgress: string;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function useOnboardingPipeline() {
  return useQuery({
    queryKey: ["onboarding-pipeline"],
    queryFn: async () => {
      const [
        { data: creators },
        { data: accounts },
        { data: onboardingLinks },
        { data: leads },
      ] = await Promise.all([
        supabase.from("creators").select("id, name, email, profile_id, created_at, status"),
        supabase.from("tiktok_accounts").select("creator_id, warmup_day, following_count"),
        supabase.from("onboarding_links").select("creator_id, completed_at, status"),
        supabase.from("closer_leads").select("id, first_name, last_name, email, status, created_at"),
      ]);

      const allCreators = creators ?? [];
      const allAccounts = accounts ?? [];
      const allLinks = onboardingLinks ?? [];

      // Linked creator IDs
      const linkedCreatorIds = new Set(allLinks.filter(l => l.creator_id).map(l => l.creator_id));

      // Build creator rows
      const rows: CreatorPipelineRow[] = allCreators.map(c => {
        const accs = allAccounts.filter(a => a.creator_id === c.id);
        const allWarmupDone = accs.length > 0 && accs.every(a => a.warmup_day >= 3 && a.following_count >= 40);
        const hasProfile = !!c.profile_id;

        let phase: CreatorPipelineRow["phase"];
        let phaseLabel: string;

        if (allWarmupDone) {
          phase = "operativi";
          phaseLabel = "Operativo";
        } else if (hasProfile) {
          phase = "warmup";
          const done = accs.filter(a => a.warmup_day >= 3 && a.following_count >= 40).length;
          phaseLabel = `Warmup (${done}/${accs.length})`;
        } else if (linkedCreatorIds.has(c.id)) {
          phase = "onboarding";
          phaseLabel = "In onboarding";
        } else {
          phase = "lead";
          phaseLabel = "Lead";
        }

        const warmupDone = accs.filter(a => a.warmup_day >= 3 && a.following_count >= 40).length;

        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phase,
          phaseLabel,
          createdAt: c.created_at,
          accountCount: accs.length,
          warmupProgress: accs.length > 0 ? `${warmupDone}/${accs.length}` : "—",
        };
      });

      // Also add leads that have no creator yet
      const creatorEmails = new Set(allCreators.map(c => c.email).filter(Boolean));
      const leadCreatorIds = new Set(allLinks.map(l => l.creator_id).filter(Boolean));
      const unlinkedLeads = (leads ?? []).filter(l => {
        if (l.email && creatorEmails.has(l.email)) return false;
        return l.status !== "done" && l.status !== "signed";
      });

      const leadRows: CreatorPipelineRow[] = unlinkedLeads.map(l => ({
        id: `lead-${l.id}`,
        name: `${l.first_name} ${l.last_name}`,
        email: l.email,
        phase: "lead" as const,
        phaseLabel: "Lead",
        createdAt: l.created_at,
        accountCount: 0,
        warmupProgress: "—",
      }));

      // Counts
      const counts = {
        lead: rows.filter(r => r.phase === "lead").length + leadRows.length,
        onboarding: rows.filter(r => r.phase === "onboarding").length,
        warmup: rows.filter(r => r.phase === "warmup").length,
        operativi: rows.filter(r => r.phase === "operativi").length,
        totale: rows.length + leadRows.length,
      };

      return { rows: [...leadRows, ...rows], counts };
    },
    refetchInterval: 30_000,
  });
}

const phaseConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  lead: { color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30", icon: UserPlus },
  onboarding: { color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", icon: Clock },
  warmup: { color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30", icon: Flame },
  operativi: { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", icon: Rocket },
};

const filterButtons: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "Tutti", icon: Users },
  { key: "lead", label: "Lead", icon: UserPlus },
  { key: "onboarding", label: "Onboarding", icon: Clock },
  { key: "warmup", label: "Warmup", icon: Flame },
  { key: "operativi", label: "Operativi", icon: Rocket },
];

export default function OnboardingMonitorPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useOnboardingPipeline();
  const [filter, setFilter] = useState<Phase>("all");

  const filtered = data?.rows.filter(r => filter === "all" || r.phase === filter) ?? [];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Onboarding Creator</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Monitora lo stato di avanzamento di ogni creator nel percorso di onboarding</p>
      </div>

      {/* Phase stat boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {filterButtons.map(fb => {
          const count = fb.key === "all"
            ? data?.counts.totale ?? 0
            : data?.counts[fb.key] ?? 0;
          const isSelected = filter === fb.key;
          const cfg = phaseConfig[fb.key] ?? { color: "text-muted-foreground", bg: "bg-muted/10", icon: Users };
          const Icon = fb.icon;

          return (
            <button
              key={fb.key}
              onClick={() => setFilter(isSelected && fb.key !== "all" ? "all" : fb.key)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/30 bg-card"
              }`}
            >
              <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              {isLoading ? (
                <div className="h-7 w-8 rounded bg-muted animate-pulse" />
              ) : (
                <span className="text-xl font-bold text-foreground">{count}</span>
              )}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{fb.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filter === "all" ? "Tutti i creator" : `Creator — ${filterButtons.find(f => f.key === filter)?.label}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nessun creator in questa fase</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Warmup</TableHead>
                  <TableHead>Data creazione</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => {
                  const cfg = phaseConfig[row.phase];
                  const PhaseIcon = cfg?.icon ?? Users;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{row.email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${cfg?.bg} ${cfg?.color} border text-xs gap-1`}>
                          <PhaseIcon className="h-3 w-3" />
                          {row.phaseLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.accountCount || "—"}</TableCell>
                      <TableCell>{row.warmupProgress}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</TableCell>
                      <TableCell>
                        {!row.id.startsWith("lead-") && (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/creators/${row.id}`)}>
                            Apri
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

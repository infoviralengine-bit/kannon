import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Flame, Rocket, BarChart3 } from "lucide-react";

export type PipelinePhase = "lead" | "onboarding" | "warmup" | "operativi" | "totale" | null;

interface PipelineData {
  lead: number;
  onboarding: number;
  warmup: number;
  operativi: number;
  totale: number;
}

export function usePipelineData() {
  return useQuery({
    queryKey: ["pipeline-creator-overview"],
    queryFn: async (): Promise<PipelineData> => {
      const [
        { data: creators },
        { data: accounts },
        { data: onboardingLinks },
        { data: leads },
      ] = await Promise.all([
        supabase.from("creators").select("id, profile_id, status"),
        supabase.from("tiktok_accounts").select("creator_id, warmup_day, following_count"),
        supabase.from("onboarding_links").select("creator_id, completed_at, status"),
        supabase.from("closer_leads").select("id, email, status"),
      ]);

      const allCreators = creators ?? [];
      const allAccounts = accounts ?? [];
      const allLinks = onboardingLinks ?? [];

      // Creator IDs that completed onboarding (have profile_id)
      const onboardedCreatorIds = new Set(allCreators.filter(c => c.profile_id).map(c => c.id));

      // Creator IDs linked in onboarding_links
      const linkedCreatorIds = new Set(allLinks.filter(l => l.creator_id).map(l => l.creator_id));

      // Warmup status per creator
      const creatorWarmupDone = new Map<string, boolean>();
      allCreators.forEach(c => {
        const accs = allAccounts.filter(a => a.creator_id === c.id);
        const done = accs.length > 0 && accs.every(a => a.warmup_day >= 3 && a.following_count >= 40);
        creatorWarmupDone.set(c.id, done);
      });

      // Leads not yet linked to a creator (not onboarded)
      const leadCreatorIds = new Set(allLinks.filter(l => l.creator_id).map(l => l.creator_id));
      const leadsNotOnboarded = (leads ?? []).filter(l => {
        // A lead is "not onboarded" if no onboarding link exists for it or it's still pending
        return l.status !== "done" && l.status !== "signed";
      });

      // Onboarding: have an onboarding link with creator but no profile_id (or link not completed)
      const onboarding = allCreators.filter(c => {
        if (c.profile_id) return false; // already onboarded
        return linkedCreatorIds.has(c.id);
      });

      // Warmup: onboarded (have profile_id) but warmup not complete
      const warmup = allCreators.filter(c => {
        if (!c.profile_id) return false;
        return !creatorWarmupDone.get(c.id);
      });

      // Operativi: warmup done
      const operativi = allCreators.filter(c => creatorWarmupDone.get(c.id));

      return {
        lead: leadsNotOnboarded.length,
        onboarding: onboarding.length,
        warmup: warmup.length,
        operativi: operativi.length,
        totale: allCreators.length,
      };
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

const phases: { key: PipelinePhase; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { key: "lead", label: "Lead", icon: UserPlus, color: "text-blue-400", bg: "bg-blue-400/10" },
  { key: "onboarding", label: "Onboarding", icon: Users, color: "text-amber-400", bg: "bg-amber-400/10" },
  { key: "warmup", label: "Warmup", icon: Flame, color: "text-orange-400", bg: "bg-orange-400/10" },
  { key: "operativi", label: "Operativi", icon: Rocket, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { key: "totale", label: "Totale", icon: BarChart3, color: "text-[#64748b]", bg: "bg-[#1a1a28]" },
];

export default function PipelineCreator({
  selected,
  onSelect,
}: {
  selected: PipelinePhase;
  onSelect: (phase: PipelinePhase) => void;
}) {
  const { data, isLoading } = usePipelineData();

  return (
    <Card className="border-[#1e1e2e] bg-[#111118]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#f8fafc] flex items-center gap-2">
          <Users className="h-4 w-4 text-[#a78bfa]" />
          Pipeline Creator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {phases.map(p => {
            const count = data?.[p.key as keyof PipelineData] ?? 0;
            const isSelected = selected === p.key;
            return (
              <button
                key={p.key}
                onClick={() => onSelect(isSelected ? null : p.key)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? `border-[#7c3aed] bg-[#7c3aed]/10`
                    : `border-[#1e1e2e] hover:border-[#2a2a3e] bg-[#0d0d14]`
                }`}
              >
                <div className={`p-2 rounded-lg ${p.bg}`}>
                  <p.icon className={`h-4 w-4 ${p.color}`} />
                </div>
                {isLoading ? (
                  <div className="h-7 w-8 rounded bg-[#1a1a28] animate-pulse" />
                ) : (
                  <span className="text-xl font-bold text-[#f8fafc]">{count}</span>
                )}
                <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">{p.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

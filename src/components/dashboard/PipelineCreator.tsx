import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Flame, Rocket, BarChart3 } from "lucide-react";

export type PipelinePhase = "warmup" | "operativi" | "totale" | null;

interface PipelineData {
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
      ] = await Promise.all([
        supabase.from("creators").select("id, profile_id, status"),
        supabase.from("tiktok_accounts").select("creator_id, warmup_day, following_count"),
      ]);

      const allCreators = creators ?? [];
      const allAccounts = accounts ?? [];

      // Warmup status per creator
      const creatorWarmupDone = new Map<string, boolean>();
      allCreators.forEach(c => {
        const accs = allAccounts.filter(a => a.creator_id === c.id);
        const done = accs.length > 0 && accs.every(a => a.warmup_day >= 3 && a.following_count >= 40);
        creatorWarmupDone.set(c.id, done);
      });

      // Warmup: warmup not complete
      const warmup = allCreators.filter(c => {
        return !creatorWarmupDone.get(c.id);
      });

      // Operativi: warmup done
      const operativi = allCreators.filter(c => creatorWarmupDone.get(c.id));

      return {
        warmup: warmup.length,
        operativi: operativi.length,
        totale: allCreators.length,
      };
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

const phases: { key: PipelinePhase; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { key: "warmup", label: "Warmup", icon: Flame, color: "text-orange-400", bg: "bg-orange-400/10" },
  { key: "operativi", label: "Operativi", icon: Rocket, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { key: "totale", label: "Totale", icon: BarChart3, color: "text-muted-foreground", bg: "bg-muted" },
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Pipeline Creator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {phases.map(p => {
            const count = data?.[p.key as keyof PipelineData] ?? 0;
            const isSelected = selected === p.key;
            return (
              <button
                key={p.key}
                onClick={() => onSelect(isSelected ? null : p.key)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? `border-primary bg-primary/10`
                    : `border-border hover:border-border bg-background`
                }`}
              >
                <div className={`p-2 rounded-lg ${p.bg}`}>
                  <p.icon className={`h-4 w-4 ${p.color}`} />
                </div>
                {isLoading ? (
                  <div className="h-7 w-8 rounded bg-muted animate-pulse" />
                ) : (
                  <span className="text-xl font-bold text-foreground">{count}</span>
                )}
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{p.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

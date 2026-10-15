import { useMemo, useState } from "react";
import { AtSign, Eye, Film, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampaignTimeline } from "@/components/dashboard/CampaignTimeline";
import { OperatorViewsChart } from "@/components/operator/OperatorViewsChart";
import { OperatorKpi } from "@/components/operator/OperatorKpi";
import { useOperatorAnalytics, useOperatorCampaigns, type OperatorFilters } from "@/hooks/useOperatorData";
import type { TimelineCampaign } from "@/hooks/useCommandCenter";
import { formatViews } from "@/lib/format";
import { isoDaysAgo, todayIso } from "@/lib/operatorDates";
import { useI18n } from "@/i18n";

const DAY = 86_400_000;
const PERIODS = [7, 14, 30, 90] as const;

export default function OperatorHomePage() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const { data: campaigns, isLoading } = useOperatorCampaigns();

  const timeline: TimelineCampaign[] = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return (campaigns ?? []).map((c) => {
      const start = new Date(c.start_date);
      const end = c.end_date ? new Date(c.end_date) : null;
      const total = end ? Math.max(1, (end.getTime() - start.getTime()) / DAY) : null;
      const elapsed = Math.max(0, (today.getTime() - start.getTime()) / DAY);
      return {
        id: c.id, name: c.name, clientName: c.client_name, logoUrl: c.logo_url,
        startDate: c.start_date, endDate: c.end_date, isOngoing: !c.end_date,
        daysLeft: end ? Math.ceil((end.getTime() - today.getTime()) / DAY) : null,
        progressPct: total ? Math.min(100, Math.round((elapsed / total) * 100)) : 0,
        creatorCount: Number(c.creator_count),
      };
    });
  }, [campaigns]);

  const filters: OperatorFilters = useMemo(() => ({
    from: isoDaysAgo(days - 1), to: todayIso(),
    campaignIds: selected ? [selected] : [], creatorIds: [], accountIds: [],
    format: null, window: null, minViews: null,
  }), [days, selected]);
  const { data: analytics } = useOperatorAnalytics(filters);
  const k = analytics?.kpis;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Panoramica")}</h1>

      <CampaignTimeline
        selectedId={selected}
        onSelect={setSelected}
        campaigns={timeline}
        loading={isLoading}
        emptyHref="/dashboard/operator/campaigns"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OperatorKpi icon={Eye} label={t("Views nel periodo")} value={formatViews(Number(k?.views ?? 0))} />
        <OperatorKpi icon={Film} label={t("Video pubblicati")} value={formatViews(Number(k?.videos ?? 0))} />
        <OperatorKpi icon={Users} label={t("Creator attivi")} value={formatViews(Number(k?.creators ?? 0))} />
        <OperatorKpi icon={AtSign} label={t("Account attivi")} value={formatViews(Number(k?.accounts ?? 0))} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{t("Performance Views")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selected ?? "all"} onValueChange={(v) => setSelected(v === "all" ? null : v)}>
              <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Tutte le campagne")}</SelectItem>
                {(campaigns ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-1 rounded-lg bg-background p-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${days === p ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t(`${p}gg`)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OperatorViewsChart daily={analytics?.daily ?? []} from={filters.from!} to={filters.to!} />
        </CardContent>
      </Card>
    </div>
  );
}

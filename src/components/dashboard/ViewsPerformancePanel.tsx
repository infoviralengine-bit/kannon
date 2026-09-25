import { useState } from "react";
import { Eye, TrendingUp, TrendingDown, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatViews } from "@/lib/format";
import { useI18n } from "@/i18n";
import { useCampaignTimeline, useCampaignViewsSeries } from "@/hooks/useCommandCenter";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-4 py-3 shadow-2xl">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatViews(payload[0].value)} views</p>
    </div>
  );
}

type Props = {
  campaignId: string | null;
  onCampaignChange: (id: string | null) => void;
};

export function ViewsPerformancePanel({ campaignId, onCampaignChange }: Props) {
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const { data: campaigns } = useCampaignTimeline();
  const { data, isLoading } = useCampaignViewsSeries(campaignId, days);

  const total = data?.total ?? 0;
  const prev = data?.previousTotal ?? 0;
  const deltaPct = prev > 0 ? ((total - prev) / prev) * 100 : null;
  const positive = (deltaPct ?? 0) >= 0;

  const periods = [
    { label: "7gg", value: 7 },
    { label: "14gg", value: 14 },
    { label: "30gg", value: 30 },
    { label: "90gg", value: 90 },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Eye className="h-4 w-4 text-primary" />
            {t("Performance Views")}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {campaignId
              ? t("Campagna selezionata dalla timeline")
              : t("Tutte le campagne")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={campaignId ?? "all"}
            onValueChange={(v) => onCampaignChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-9 w-[200px] text-xs">
              <SelectValue placeholder={t("Tutte le campagne")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Tutte le campagne")}</SelectItem>
              {(campaigns ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 rounded-lg bg-background p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  days === p.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Views nel periodo")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{formatViews(total)}</p>
            {deltaPct !== null && (
              <span className={`mt-1 flex items-center gap-1 text-xs ${positive ? "text-emerald-400" : "text-red-400"}`}>
                {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {positive ? "+" : ""}{deltaPct.toFixed(1)}% {t("vs periodo precedente")}
              </span>
            )}
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Media al giorno")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{formatViews(data?.dailyAverage ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Gauge className="h-3 w-3" /> {t("Uso del tetto per video")}
            </p>
            {data?.capUsedPct != null ? (
              <>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{data.capUsedPct}%</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${data.capUsedPct >= 90 ? "bg-red-500" : data.capUsedPct >= 70 ? "bg-amber-400" : "bg-primary"}`}
                    style={{ width: `${data.capUsedPct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{t("Nessun tetto impostato")}</p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="h-[340px] w-full animate-pulse rounded-lg bg-muted" />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={data?.points ?? []} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="ccViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={days <= 14 ? 1 : days <= 30 ? 3 : 11}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#ccViews)"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default ViewsPerformancePanel;

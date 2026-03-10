import { useState } from "react";
import PipelineCreator from "@/components/dashboard/PipelineCreator";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight,
  AlertTriangle, AlertCircle, CheckCircle2, Trophy, Clock, Zap,
  Calendar, Eye, Users, CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatViews, formatCurrency } from "@/lib/format";
import { useCountUp } from "@/hooks/useCountUp";
import {
  useFinancialKpis,
  useViewsChart,
  useActiveCampaignCards,
  useCreatorStatus,
  useDeadlinesAndAlerts,
} from "@/hooks/useGeneraleDashboardData";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ─── Skeleton ─── */
function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#1a1a28] ${className}`} />;
}

/* ─── KPI Card ─── */
function KpiFinancialCard({
  label, icon: Icon, value, prevValue, prefix = "€", accentClass, loading,
}: {
  label: string;
  icon: React.ElementType;
  value: number;
  prevValue?: number;
  prefix?: string;
  accentClass: string;
  loading: boolean;
}) {
  const animated = useCountUp(value, 1400, !loading);
  const diff = prevValue !== undefined ? value - prevValue : undefined;
  const diffPct = prevValue && prevValue > 0 ? ((diff ?? 0) / prevValue) * 100 : undefined;
  const isPositive = (diff ?? 0) >= 0;

  return (
    <Card className="relative overflow-hidden border-[#1e1e2e] bg-[#111118] hover:border-[#2a2a3e] transition-all duration-300 group">
      <div className={`absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity ${accentClass}`}
        style={{ background: `radial-gradient(ellipse at top right, currentColor, transparent 70%)` }}
      />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">{label}</span>
          <div className={`p-2 rounded-lg ${accentClass} bg-opacity-10`} style={{ backgroundColor: 'currentColor', opacity: 0.08 }}>
            <Icon className={`h-4 w-4 ${accentClass}`} />
          </div>
        </div>
        {loading ? (
          <Shimmer className="h-9 w-36 mb-2" />
        ) : (
          <>
            <p className="text-2xl font-bold text-[#f8fafc] tabular-nums tracking-tight">
              {prefix}{animated.toLocaleString("it-IT", { minimumFractionDigits: prefix === "€" ? 2 : 0, maximumFractionDigits: 2 })}
            </p>
            {diff !== undefined && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {isPositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className={`text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                  {isPositive ? "+" : ""}{diffPct?.toFixed(1)}%
                </span>
                <span className="text-xs text-[#64748b]">vs mese scorso</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Custom Tooltip for Chart ─── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-[#64748b] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#f8fafc]">{formatViews(payload[0].value)} views</p>
    </div>
  );
}

/* ─── Period Selector ─── */
function PeriodSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const options = [
    { label: "7gg", value: 7 },
    { label: "30gg", value: 30 },
    { label: "90gg", value: 90 },
  ];
  return (
    <div className="flex gap-1 bg-[#0d0d14] rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            value === o.value
              ? "bg-[#7c3aed]/20 text-[#a78bfa]"
              : "text-[#64748b] hover:text-[#94a3b8]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */
export default function GeneralePage() {
  const navigate = useNavigate();
  const [chartDays, setChartDays] = useState(30);

  const financial = useFinancialKpis();
  const viewsChart = useViewsChart(chartDays);
  const campaignCards = useActiveCampaignCards();
  const creatorStatus = useCreatorStatus();
  const deadlines = useDeadlinesAndAlerts();

  const kpi = financial.data;
  const kpiLoading = financial.isLoading;

  const totalChartViews = (viewsChart.data ?? []).reduce((s, d) => s + d.views, 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f8fafc] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Panoramica in tempo reale</p>
        </div>
        <Badge variant="outline" className="border-[#1e1e2e] text-[#64748b] text-xs gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Aggiornamento automatico
        </Badge>
      </div>

      {/* ROW 1 — Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiFinancialCard
          label="Entrate Fisse"
          icon={TrendingUp}
          value={kpi?.fixedIncome ?? 0}
          accentClass="text-emerald-400"
          loading={kpiLoading}
        />
        <KpiFinancialCard
          label="Uscite Fisse"
          icon={TrendingDown}
          value={kpi?.fixedExpense ?? 0}
          accentClass="text-red-400"
          loading={kpiLoading}
        />
        <KpiFinancialCard
          label="Margine CPM"
          icon={DollarSign}
          value={kpi?.cpmMargin ?? 0}
          accentClass="text-[#a78bfa]"
          loading={kpiLoading}
        />
        <KpiFinancialCard
          label="Margine Totale"
          icon={DollarSign}
          value={(kpi?.fixedIncome ?? 0) - (kpi?.fixedExpense ?? 0) + (kpi?.cpmMargin ?? 0)}
          accentClass="text-amber-400"
          loading={kpiLoading}
        />
      </div>

      {/* CPM detail bar */}
      {!kpiLoading && kpi && kpi.clientCpmTotal > 0 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-[#64748b]">CPM Margin</span>
          <div className="flex-1 h-1.5 rounded-full bg-[#1a1a28] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, (kpi.cpmMargin / kpi.clientCpmTotal) * 100))}%` }}
            />
          </div>
          <span className="text-xs font-medium text-[#a78bfa]">
            {((kpi.cpmMargin / kpi.clientCpmTotal) * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Pipeline Creator */}
      <PipelineCreator selected={null} onSelect={() => {}} />

      {/* ROW 2 — Views Chart */}
      <Card className="border-[#1e1e2e] bg-[#111118]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold text-[#f8fafc]">
              Performance Views
            </CardTitle>
            <p className="text-xs text-[#64748b] mt-0.5">
              {formatViews(totalChartViews)} views totali nel periodo
            </p>
          </div>
          <PeriodSelector value={chartDays} onChange={setChartDays} />
        </CardHeader>
        <CardContent className="pt-2">
          {viewsChart.isLoading ? (
            <Shimmer className="h-[280px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={viewsChart.data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartDays <= 7 ? 0 : chartDays <= 30 ? 4 : 13}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#viewsGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#a78bfa", stroke: "#111118", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ROW 3 — Active Campaigns */}
      <div>
        <h2 className="text-lg font-semibold text-[#f8fafc] mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#a78bfa]" />
          Campagne Attive
        </h2>
        {campaignCards.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Shimmer key={i} className="h-44" />)}
          </div>
        ) : !campaignCards.data?.length ? (
          <Card className="border-[#1e1e2e] bg-[#111118]">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Zap className="h-10 w-10 text-[#2a2a3e] mb-3" />
              <p className="text-sm text-[#64748b] mb-4">Nessuna campagna attiva</p>
              <Button onClick={() => navigate("/dashboard/campaigns")} size="sm">
                Crea la tua prima campagna
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaignCards.data.map((c) => {
              const capWarning = c.spendCapPercent !== null && c.spendCapPercent >= 80;
              const capReached = c.spendCapPercent !== null && c.spendCapPercent >= 100;
              const borderClass = capReached
                ? "border-red-500/40"
                : capWarning
                  ? "border-amber-500/40"
                  : "border-[#1e1e2e] hover:border-[#2a2a3e]";

              return (
                <Card
                  key={c.id}
                  className={`bg-[#111118] cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-[#7c3aed]/5 ${borderClass}`}
                  onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-[#f8fafc] text-sm">{c.name}</p>
                        <p className="text-xs text-[#64748b] mt-0.5">{c.clientName}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {capReached && (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                            🔴 Cap raggiunto
                          </Badge>
                        )}
                        {capWarning && !capReached && (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                            ⚠️ Cap vicino
                          </Badge>
                        )}
                      </div>
                    </div>

                    {c.spendCap && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-[#64748b] mb-1">
                          <span>Spesa {formatCurrency(c.revenueMonth)}</span>
                          <span>Cap {formatCurrency(c.spendCap)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1a1a28] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              capReached ? "bg-red-500" : capWarning ? "bg-amber-400" : "bg-[#7c3aed]"
                            }`}
                            style={{ width: `${Math.min(100, c.spendCapPercent ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#1e1e2e]">
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase">Views</p>
                        <p className="text-sm font-semibold text-[#f8fafc]">{formatViews(c.viewsMonth)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase">Entrata</p>
                        <p className="text-sm font-semibold text-emerald-400">{formatCurrency(c.revenueMonth)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase">Creator</p>
                        <p className="text-sm font-semibold text-[#f8fafc]">{c.creatorCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ROW 4 — Alert Sistema */}
      <div className="grid grid-cols-1 gap-4">

        {/* System Alerts */}
        <Card className="border-[#1e1e2e] bg-[#111118]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#f8fafc] flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#64748b]" />
              Alert Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.isLoading ? (
              <Shimmer className="h-16" />
            ) : !deadlines.data?.systemAlerts.length ? (
              <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Nessun problema rilevato ✓</span>
              </div>
            ) : (
              <div className="space-y-2">
                {deadlines.data.systemAlerts.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-3 rounded-lg border ${
                      a.severity === "red"
                        ? "border-red-500/20 bg-red-500/5"
                        : a.severity === "yellow"
                          ? "border-amber-500/20 bg-amber-500/5"
                          : "border-[#1e1e2e] bg-[#0d0d14]"
                    }`}
                  >
                    <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${
                      a.severity === "red" ? "text-red-400" : a.severity === "yellow" ? "text-amber-400" : "text-[#64748b]"
                    }`} />
                    <span className="text-sm text-[#94a3b8]">{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 5 — Top Performers + Payment Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Performers */}
        <Card className="border-[#1e1e2e] bg-[#111118]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#f8fafc] flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Top Performer del Mese
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creatorStatus.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Shimmer key={i} className="h-14" />)}
              </div>
            ) : !creatorStatus.data?.topPerformers.length ? (
              <p className="text-sm text-[#64748b] text-center py-8">Nessun dato disponibile</p>
            ) : (
              <div className="space-y-2">
                {creatorStatus.data.topPerformers.map((p, i) => {
                  const medalColors = ["text-amber-400", "text-slate-400", "text-orange-400"];
                  const bgColors = ["bg-amber-400/5", "bg-slate-400/5", "bg-orange-400/5"];
                  return (
                    <div
                      key={p.creatorName}
                      className={`flex items-center gap-3 p-3 rounded-lg border border-[#1e1e2e] ${bgColors[i]}`}
                    >
                      <span className={`text-lg font-bold ${medalColors[i]} w-7 text-center`}>
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#f8fafc] truncate">{p.creatorName}</p>
                        <p className="text-[10px] text-[#64748b] truncate">{p.contractName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#f8fafc]">{formatViews(p.viewsMonth)}</p>
                        <p className="text-[10px] text-emerald-400">{formatCurrency(p.cpmEarned)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Deadlines */}
        <Card className="border-[#1e1e2e] bg-[#111118]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#f8fafc] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#64748b]" />
              Scadenze Pagamenti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Da Ricevere (Clienti) */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">Da Ricevere (Clienti)</p>
              {deadlines.isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Shimmer key={i} className="h-10" />)}
                </div>
              ) : !deadlines.data?.deadlines.length ? (
                <p className="text-[11px] text-[#64748b] py-2">Nessuna scadenza clienti in arrivo</p>
              ) : (
                <div className="space-y-2">
                  {deadlines.data.deadlines.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#1e1e2e] bg-[#0d0d14]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#f8fafc] truncate">{d.campaignName}</p>
                        <p className="text-[10px] text-[#64748b]">{d.clientName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#f8fafc]">{formatCurrency(d.amount)}</span>
                        <Badge
                          className={`text-[10px] ${
                            d.isOverdue
                              ? "bg-red-500/15 text-red-400 border-red-500/30"
                              : d.daysUntil <= 3
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-[#1a1a28] text-[#64748b] border-[#2a2a3e]"
                          }`}
                        >
                          {d.isOverdue ? "Scaduto" : `${d.daysUntil}gg`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Da Pagare (Creator) */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-2">Da Pagare (Creator)</p>
              {deadlines.isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Shimmer key={`cr-${i}`} className="h-10" />)}
                </div>
              ) : !deadlines.data?.creatorDeadlines?.filter((d) => !d.isPaid).length ? (
                <p className="text-[11px] text-[#64748b] py-2">Nessun pagamento creator in sospeso</p>
              ) : (
                <div className="space-y-2">
                  {deadlines.data.creatorDeadlines.filter((d) => !d.isPaid).map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#1e1e2e] bg-[#0d0d14]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#f8fafc] truncate">{d.creatorName}</p>
                        <p className="text-[10px] text-[#64748b]">{d.periodLabel}</p>
                      </div>
                      <span className="text-sm font-semibold text-[#f8fafc]">{formatCurrency(d.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

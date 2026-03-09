import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClientAreaData, useClientDailyViews } from "@/hooks/usePortalData";
import { useCountUp } from "@/hooks/useCountUp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LogOut, Eye, Heart, MessageCircle, Users, Video,
  CalendarDays, AtSign, ExternalLink, BarChart3, Wallet,
} from "lucide-react";
import { formatViews, formatCurrency } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

type Period = "1d" | "7d" | "30d" | "90d";

const periodLabels: Record<Period, string> = {
  "1d": "Oggi",
  "7d": "7 giorni",
  "30d": "30 giorni",
  "90d": "90 giorni",
};

/* ── Header ─────────────────────────────────────── */
function ClientHeader() {
  const { profile, signOut } = useAuth();
  return (
    <header className="border-b border-border/50 bg-card/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm shadow-lg shadow-primary/20">
          K
        </div>
        <span className="font-semibold text-lg tracking-tight">Kannon</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.full_name}</span>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />Esci
        </Button>
      </div>
    </header>
  );
}

/* ── Stat Card ──────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color = "text-primary", prefix = "" }: {
  icon: React.ElementType; label: string; value: number; color?: string; prefix?: string;
}) {
  const animated = useCountUp(value);
  return (
    <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/40">
      <CardContent className="flex flex-col items-center gap-2 py-6">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color} bg-current/10`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-bold tabular-nums">{prefix}{formatViews(animated)}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  );
}

/* ── Chart Section ──────────────────────────────── */
type ChartMode = "daily" | "weekly" | "monthly";

function ViewsChart() {
  const [mode, setMode] = useState<ChartMode>("daily");
  const days = mode === "daily" ? 30 : mode === "weekly" ? 90 : 365;
  const { data: rawData, isLoading } = useClientDailyViews(days);

  const chartData = useMemo(() => {
    if (!rawData?.length) return [];

    if (mode === "daily") {
      return rawData.slice(-30).map((d) => ({
        label: new Date(d.day).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
        views: d.views,
        videos: d.videos_published,
      }));
    }

    if (mode === "weekly") {
      const weeks: { label: string; views: number; videos: number }[] = [];
      for (let i = 0; i < rawData.length; i += 7) {
        const chunk = rawData.slice(i, i + 7);
        const totalViews = chunk.reduce((s, d) => s + d.views, 0);
        const totalVids = chunk.reduce((s, d) => s + d.videos_published, 0);
        const startLabel = new Date(chunk[0].day).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
        weeks.push({ label: `Sett. ${startLabel}`, views: totalViews, videos: totalVids });
      }
      return weeks;
    }

    // monthly
    const monthMap = new Map<string, { views: number; videos: number }>();
    rawData.forEach((d) => {
      const dt = new Date(d.day);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const label = dt.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
      const existing = monthMap.get(key) || { views: 0, videos: 0 };
      monthMap.set(key, {
        views: existing.views + d.views,
        videos: existing.videos + d.videos_published,
      });
    });
    return Array.from(monthMap.entries()).map(([, v]) => ({
      label: "",
      ...v,
    }));
  }, [rawData, mode]);

  // Fix monthly labels
  const finalData = useMemo(() => {
    if (mode !== "monthly" || !rawData?.length) return chartData;
    const monthMap = new Map<string, string>();
    rawData.forEach((d) => {
      const dt = new Date(d.day);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, dt.toLocaleDateString("it-IT", { month: "short" }).toUpperCase());
      }
    });
    const labels = Array.from(monthMap.values());
    return chartData.map((d, i) => ({ ...d, label: labels[i] || "" }));
  }, [chartData, rawData, mode]);

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  return (
    <Card className="border-border/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Andamento Views
        </CardTitle>
        <Tabs value={mode} onValueChange={(v) => setMode(v as ChartMode)}>
          <TabsList className="h-8">
            <TabsTrigger value="daily" className="text-xs px-3 h-6">Giorno</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs px-3 h-6">Settimana</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs px-3 h-6">Mese</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {finalData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Nessun dato disponibile</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={finalData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={mode === "daily" ? 4 : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                width={45}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number, name: string) => [
                  formatViews(value),
                  name === "views" ? "Views" : "Video",
                ]}
              />
              <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="videos" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Spend Progress ─────────────────────────────── */
function SpendProgress({ data }: { data: NonNullable<ReturnType<typeof useClientAreaData>["data"]> }) {
  const { campaign, active_creators, views_30d } = data;
  const cap = campaign.monthly_spend_cap;
  if (!cap) return null;

  const fixedSpend = (campaign.client_fixed_per_creator ?? 0) * active_creators;
  const cpmSpend = (campaign.client_cpm ?? 0) * (views_30d / 1000);
  const totalSpend = fixedSpend + cpmSpend;
  const pct = Math.min((totalSpend / Number(cap)) * 100, 100);

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Budget Mensile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
            <p className="text-xs text-muted-foreground">di {formatCurrency(Number(cap))}</p>
          </div>
          <span className={`text-sm font-semibold ${pct >= 90 ? "text-destructive" : pct >= 70 ? "text-yellow-500" : "text-green-500"}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <Progress
          value={pct}
          className="h-2.5 bg-muted/50"
        />
        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Fisso</p>
            <p className="font-medium">{formatCurrency(fixedSpend)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">CPM</p>
            <p className="font-medium">{formatCurrency(cpmSpend)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main ───────────────────────────────────────── */
export default function ClientArea() {
  const { data, isLoading } = useClientAreaData();
  const [period, setPeriod] = useState<Period>("30d");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ClientHeader />
        <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ClientHeader />
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <h2 className="text-xl font-semibold mb-2">Nessuna campagna collegata</h2>
            <p className="text-muted-foreground">Contatta l'agenzia per collegare la tua campagna.</p>
          </div>
        </div>
      </div>
    );
  }

  const views = data[`views_${period}`];
  const likes = data[`likes_${period}`];
  const comments = data[`comments_${period}`];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ClientHeader />

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-8 animate-fade-in">
        {/* Campaign title & status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{data.campaign.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{data.campaign.client_name}</p>
          </div>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${data.campaign.status === "active" ? "bg-green-500/10 text-green-500 ring-1 ring-green-500/20" : "bg-muted text-muted-foreground"}`}>
            {data.campaign.status === "active" ? "● Attiva" : data.campaign.status}
          </span>
        </div>

        {/* Period selector */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <TabsTrigger key={p} value={p}>{periodLabels[p]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Performance metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={Eye} label="Visualizzazioni" value={views} />
          <StatCard icon={Heart} label="Like" value={likes} color="text-rose-500" />
          <StatCard icon={MessageCircle} label="Commenti" value={comments} color="text-sky-500" />
        </div>

        {/* Operational stats row */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={Users} label="Account Attivi" value={data.active_creators} />
          <StatCard icon={Video} label="Video Oggi" value={data.videos_today} />
          <StatCard icon={Video} label="Video Totali" value={data.total_videos} />
        </div>

        {/* Chart full width */}
        <ViewsChart />

        {/* Spend Progress full width */}
        <SpendProgress data={data} />

        {/* Campaign info – single line */}
        <Card className="border-border/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-6 py-4 px-6 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Inizio</span>
              <span className="font-medium">{new Date(data.campaign.start_date).toLocaleDateString("it-IT")}</span>
            </div>
            {data.campaign.end_date && (
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Fine</span>
                <span className="font-medium">{new Date(data.campaign.end_date).toLocaleDateString("it-IT")}</span>
              </div>
            )}
            {data.campaign.video_views_cap != null && (
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Cap Views</span>
                <span className="font-medium">{formatViews(data.campaign.video_views_cap)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account list */}
        {data.accounts && data.accounts.length > 0 && (
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AtSign className="h-5 w-5 text-primary" /> Account TikTok
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Views 30gg</TableHead>
                    <TableHead className="text-right">Video Totali</TableHead>
                    <TableHead className="text-right">Video Oggi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accounts.map((acc) => (
                    <TableRow key={acc.username} className="group">
                      <TableCell>
                        <a
                          href={`https://www.tiktok.com/@${acc.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline transition-colors"
                        >
                          @{acc.username}
                          <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatViews(acc.views_30d)}</TableCell>
                      <TableCell className="text-right tabular-nums">{acc.total_videos}</TableCell>
                      <TableCell className="text-right tabular-nums">{acc.videos_today}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center pb-4">Dati aggiornati ogni 2 ore</p>
      </div>

      <footer className="border-t border-border/40 py-4 text-center">
        <p className="text-xs text-muted-foreground">Powered by Kannon</p>
      </footer>
    </div>
  );
}

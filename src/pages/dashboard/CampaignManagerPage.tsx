import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Minus, ArrowUp, ArrowDown, Eye, Users, FileText, DollarSign, ExternalLink } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart,
} from "recharts";
import { useCampaignManagerData, Period } from "@/hooks/useCampaignManagerData";
import { formatViews, formatCurrency } from "@/lib/format";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 giorni" },
  { value: "30d", label: "30 giorni" },
  { value: "90d", label: "3 mesi" },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

function trendPercent(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const pct = trendPercent(current, prev);
  if (pct === 0)
    return <span className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> 0%</span>;
  if (pct > 0)
    return <span className="text-xs text-emerald-600 flex items-center gap-1"><ArrowUp className="h-3 w-3" /> +{pct}%</span>;
  return <span className="text-xs text-red-500 flex items-center gap-1"><ArrowDown className="h-3 w-3" /> {pct}%</span>;
}

export default function CampaignManagerPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [videoCampaignFilter, setVideoCampaignFilter] = useState("all");
  const [videoCreatorFilter, setVideoCreatorFilter] = useState("all");
  const [showAllVideos, setShowAllVideos] = useState(false);

  const { data, isLoading } = useCampaignManagerData(period);

  const chartCampaignNames = useMemo(() => {
    if (!data) return [];
    const names = new Set<string>();
    data.dailyViews.forEach((d) => {
      Object.keys(d).forEach((k) => { if (k !== "date") names.add(k); });
    });
    return [...names];
  }, [data]);

  // Unique creators for filter
  const creatorOptions = useMemo(() => {
    if (!data || !data.videos) return [];
    const map = new Map<string, string>();
    data.videos.forEach((v) => {
      if (!map.has(v.creatorId)) map.set(v.creatorId, v.creatorName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredVideos = useMemo(() => {
    if (!data || !data.videos) return [];
    let list = data.videos;
    if (videoCampaignFilter !== "all") {
      list = list.filter((v) => v.campaignId === videoCampaignFilter);
    }
    if (videoCreatorFilter !== "all") {
      list = list.filter((v) => v.creatorId === videoCreatorFilter);
    }
    return showAllVideos ? list : list.slice(0, 30);
  }, [data, videoCampaignFilter, videoCreatorFilter, showAllVideos]);

  const totalFilteredVideos = useMemo(() => {
    if (!data) return 0;
    let list = data.videos;
    if (videoCampaignFilter !== "all") list = list.filter((v) => v.campaignId === videoCampaignFilter);
    if (videoCreatorFilter !== "all") list = list.filter((v) => v.creatorId === videoCreatorFilter);
    return list.length;
  }, [data, videoCampaignFilter, videoCreatorFilter]);

  // Insights
  const insights = useMemo(() => {
    if (!data) return [];
    const items: { emoji: string; title: string; text: string }[] = [];

    const bestCamp = [...data.campaigns].sort((a, b) => b.views - a.views)[0];
    if (bestCamp) {
      const pct = trendPercent(bestCamp.views, bestCamp.prevViews);
      if (pct > 0) {
        items.push({ emoji: "📈", title: `${bestCamp.name} in crescita`, text: `+${pct}% di views rispetto al periodo precedente.` });
      }
    }

    const worstCamp = [...data.campaigns].sort((a, b) => trendPercent(a.views, a.prevViews) - trendPercent(b.views, b.prevViews))[0];
    if (worstCamp && trendPercent(worstCamp.views, worstCamp.prevViews) < -5) {
      items.push({ emoji: "📉", title: `${worstCamp.name} in calo`, text: `${trendPercent(worstCamp.views, worstCamp.prevViews)}% rispetto al periodo precedente.` });
    }

    const topCreator = data.creatorRanking[0];
    if (topCreator) {
      items.push({ emoji: "🏆", title: `Top creator: ${topCreator.creatorName}`, text: `${formatViews(topCreator.views)} views nel periodo.` });
    }

    const inactive = data.creatorRanking.filter((c) => c.dailyViews.every((v) => v === 0));
    if (inactive.length > 0) {
      items.push({ emoji: "⚠️", title: `${inactive.length} creator inattivi`, text: `Nessun contenuto pubblicato negli ultimi 7 giorni.` });
    }

    return items;
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) return null;

  const maxCampViews = Math.max(...data.campaigns.map((c) => c.views), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Campaign Manager</h1>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={period === opt.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(opt.value)}
              className="text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ROW 1 — KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Eye className="h-4 w-4" /> Views Totali
            </div>
            <p className="text-3xl font-bold text-foreground">{formatViews(data.totalViews)}</p>
            <TrendBadge current={data.totalViews} prev={data.prevTotalViews} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" /> Creator Attivi
            </div>
            <p className="text-3xl font-bold text-foreground">{data.activeCreators}</p>
            <TrendBadge current={data.activeCreators} prev={data.prevActiveCreators} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <FileText className="h-4 w-4" /> Contenuti Pubblicati
            </div>
            <p className="text-3xl font-bold text-foreground">{data.publishedContent}</p>
            <TrendBadge current={data.publishedContent} prev={data.prevPublishedContent} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" /> CPM Medio
            </div>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(data.avgCpm)}</p>
            <TrendBadge current={data.avgCpm} prev={data.prevAvgCpm} />
          </CardContent>
        </Card>
      </div>

      {/* ROW 2 — Chart + Campaign summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Views nel tempo</h2>
            <ResponsiveContainer width="100%" height={300}>
              {chartCampaignNames.length <= 1 ? (
                <AreaChart data={data.dailyViews}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip />
                  {chartCampaignNames.map((name, i) => (
                    <Area key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
                  ))}
                </AreaChart>
              ) : (
                <LineChart data={data.dailyViews}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Legend />
                  {chartCampaignNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Campagne: riepilogo</h2>
            <div className="space-y-4">
              {data.campaigns.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => { setVideoCampaignFilter(camp.id); setVideoCreatorFilter("all"); setShowAllVideos(false); }}
                  className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-foreground">{camp.name}</span>
                    <TrendBadge current={camp.views} prev={camp.prevViews} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{formatViews(camp.views)} views</span>
                    <span>{camp.activeCreators} creator</span>
                  </div>
                  <Progress value={(camp.views / maxCampViews) * 100} className="h-1.5" />
                </button>
              ))}
              {data.campaigns.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nessuna campagna attiva</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROW 3 — Video List */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Video Pubblicati</h2>
            <div className="flex gap-2">
              <Select value={videoCampaignFilter} onValueChange={(v) => { setVideoCampaignFilter(v); setShowAllVideos(false); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tutte le campagne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le campagne</SelectItem>
                  {data.campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={videoCreatorFilter} onValueChange={(v) => { setVideoCreatorFilter(v); setShowAllVideos(false); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tutti i creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i creator</SelectItem>
                  {creatorOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Campagna</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Commenti</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVideos.map((v) => (
                <TableRow key={v.videoId}>
                  <TableCell>
                    <a
                      href={`https://www.tiktok.com/@${v.username}/video/${v.tiktokVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      @{v.username}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">{v.creatorName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{v.campaignName}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatViews(v.views)}</TableCell>
                  <TableCell className="text-right">{formatViews(v.likes)}</TableCell>
                  <TableCell className="text-right">{formatViews(v.comments)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(v.publishedAt).toLocaleDateString("it-IT")}
                  </TableCell>
                </TableRow>
              ))}
              {filteredVideos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nessun video trovato
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {!showAllVideos && totalFilteredVideos > 30 && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowAllVideos(true)}>
                Mostra tutti ({totalFilteredVideos})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROW 4 — Insights */}
      {insights.length > 0 && (
        <div className="bg-muted/50 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3">Insights</h2>
          <ScrollArea className="w-full">
            <div className="flex gap-3 pb-2">
              {insights.map((ins, i) => (
                <Card key={i} className="min-w-[260px] max-w-[300px] shrink-0">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-2xl mb-1">{ins.emoji}</p>
                    <p className="font-semibold text-sm text-foreground">{ins.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ins.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

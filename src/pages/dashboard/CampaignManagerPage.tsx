import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Minus, ArrowUp, ArrowDown, Eye, Users, FileText, ExternalLink,
  Flame, Zap, TrendingUp, BarChart3, X, Plus, Check,
} from "lucide-react";
import { cleanUsername } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart,
} from "recharts";
import { useCampaignManagerData, useVideoFormats, Period, VideoItem } from "@/hooks/useCampaignManagerData";
import { formatViews } from "@/lib/format";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

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

function ViralBadge({ velocity }: { velocity: number }) {
  if (velocity >= 100_000)
    return <Badge className="bg-red-500 text-white hover:bg-red-500/90">🔥 Virale</Badge>;
  if (velocity >= 50_000)
    return <Badge className="bg-orange-500 text-white hover:bg-orange-500/90">🚀 Esplodendo</Badge>;
  if (velocity >= 10_000)
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">⚡ In crescita</Badge>;
  return null;
}

function DurationBadge({ sec }: { sec: number | null }) {
  if (sec === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (sec <= 15) return <Badge variant="outline" className="text-xs">⚡ {sec}s</Badge>;
  if (sec <= 30) return <Badge variant="outline" className="text-xs">▶ {sec}s</Badge>;
  return <Badge variant="outline" className="text-xs">🎬 {sec}s</Badge>;
}

function ContentTagCell({
  video,
  formats,
  onSave,
}: {
  video: VideoItem;
  formats: { id: string; name: string }[];
  onSave: (tag: string | null) => void;
}) {
  return (
    <Select
      value={video.contentTag ?? "__none__"}
      onValueChange={(v) => onSave(v === "__none__" ? null : v)}
    >
      <SelectTrigger className="h-7 text-xs w-36 border-dashed">
        <SelectValue placeholder="Formato..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">Nessuno</span>
        </SelectItem>
        {formats.map((f) => (
          <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function CampaignManagerPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [videoCampaignFilter, setVideoCampaignFilter] = useState("all");
  const [videoCreatorFilter, setVideoCreatorFilter] = useState("all");
  const [videoFormatFilter, setVideoFormatFilter] = useState("all");
  const [videoPeriodFilter, setVideoPeriodFilter] = useState<"7d" | "14d" | "30d" | "90d" | "all">("all");
  const [videoSort, setVideoSort] = useState<
    "date" | "views" | "velocity" | "engagement" | "quality" | "comments" | "likes" | "saves" | "shares"
  >("views");
  const [minKpiValue, setMinKpiValue] = useState<string>("");
  const [videoSearch, setVideoSearch] = useState<string>("");
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [newFormatName, setNewFormatName] = useState("");
  // Chart filter: list of campaign names selected. Empty array = all campaigns.
  const [chartCampaigns, setChartCampaigns] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data, isLoading } = useCampaignManagerData(period);
  const { data: formats, refetch: refetchFormats } = useVideoFormats();

  const saveTag = useMutation({
    mutationFn: async ({ videoId, tag }: { videoId: string; tag: string | null }) => {
      const { error } = await supabase
        .from("videos")
        .update({ content_tag: tag })
        .eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-manager"] });
      toast({ title: "Formato salvato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const addFormat = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("video_formats" as any).insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchFormats();
      toast({ title: "Formato aggiunto" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const deleteFormat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("video_formats" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchFormats();
      toast({ title: "Formato eliminato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const chartCampaignNames = useMemo(() => {
    if (!data) return [];
    const names = new Set<string>();
    data.dailyViews.forEach((d) => {
      Object.keys(d).forEach((k) => { if (k !== "date") names.add(k); });
    });
    return [...names];
  }, [data]);

  // Aggregate daily totals across selected campaigns (empty = all).
  const dailyTotals = useMemo(() => {
    if (!data) return [] as { date: string; views: number; label: string }[];
    const selected = new Set(chartCampaigns);
    return data.dailyViews.map((d) => {
      const total = Object.entries(d).reduce((s, [k, v]) => {
        if (k === "date") return s;
        if (selected.size > 0 && !selected.has(k)) return s;
        return s + (typeof v === "number" ? v : 0);
      }, 0);
      const dt = new Date(d.date as string);
      const label = dt.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
      return { date: d.date as string, views: total, label };
    });
  }, [data, chartCampaigns]);

  const chartTotalViews = useMemo(
    () => dailyTotals.reduce((s, d) => s + d.views, 0),
    [dailyTotals]
  );

  // Total views across the period — denominator for "share of voice" bars.
  const totalPeriodViews = useMemo(() => {
    if (!data) return 0;
    return data.campaigns.reduce((s, c) => s + c.views, 0);
  }, [data]);

  const creatorOptions = useMemo(() => {
    if (!data || !data.videos) return [];
    const map = new Map<string, string>();
    data.videos.forEach((v) => {
      if (!map.has(v.creatorId)) map.set(v.creatorId, v.creatorName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredAndSortedVideos = useMemo(() => {
    if (!data?.allVideos) return [];
    let list = [...data.allVideos];
    if (videoPeriodFilter !== "all") {
      const days = videoPeriodFilter === "7d" ? 7 : videoPeriodFilter === "14d" ? 14 : videoPeriodFilter === "30d" ? 30 : 90;
      const cutoff = Date.now() - days * 86_400_000;
      list = list.filter((v) => new Date(v.publishedAt).getTime() >= cutoff);
    }
    if (videoCampaignFilter !== "all") list = list.filter((v) => v.campaignId === videoCampaignFilter);
    if (videoCreatorFilter !== "all") list = list.filter((v) => v.creatorId === videoCreatorFilter);
    if (videoFormatFilter !== "all") list = list.filter((v) => v.contentTag === videoFormatFilter);
    if (videoSearch.trim()) {
      const q = videoSearch.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.username.toLowerCase().includes(q) ||
          v.creatorName.toLowerCase().includes(q) ||
          v.campaignName.toLowerCase().includes(q),
      );
    }
    const kpiValue = (v: VideoItem) => {
      switch (videoSort) {
        case "views": return v.views;
        case "velocity": return v.viralVelocity;
        case "engagement": return v.engagementRate;
        case "quality": return v.qualityScore;
        case "comments": return v.comments;
        case "likes": return v.likes;
        case "saves": return v.saves ?? 0;
        case "shares": return v.shares ?? 0;
        case "date": return new Date(v.publishedAt).getTime();
      }
    };
    const min = parseFloat(minKpiValue.replace(",", "."));
    if (!isNaN(min) && min > 0 && videoSort !== "date") {
      list = list.filter((v) => kpiValue(v) >= min);
    }
    switch (videoSort) {
      case "views":      list.sort((a, b) => b.views - a.views); break;
      case "velocity":   list.sort((a, b) => b.viralVelocity - a.viralVelocity); break;
      case "engagement": list.sort((a, b) => b.engagementRate - a.engagementRate); break;
      case "quality":    list.sort((a, b) => b.qualityScore - a.qualityScore); break;
      case "comments":   list.sort((a, b) => b.comments - a.comments); break;
      case "likes":      list.sort((a, b) => b.likes - a.likes); break;
      case "saves":      list.sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0)); break;
      case "shares":     list.sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0)); break;
      case "date":       list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()); break;
    }
    return showAllVideos ? list : list.slice(0, 30);
  }, [data, videoCampaignFilter, videoCreatorFilter, videoFormatFilter, videoPeriodFilter, videoSort, showAllVideos, minKpiValue, videoSearch]);

  const totalFilteredVideos = useMemo(() => {
    if (!data?.allVideos) return 0;
    let list = data.allVideos;
    if (videoPeriodFilter !== "all") {
      const days = videoPeriodFilter === "7d" ? 7 : videoPeriodFilter === "14d" ? 14 : videoPeriodFilter === "30d" ? 30 : 90;
      const cutoff = Date.now() - days * 86_400_000;
      list = list.filter((v) => new Date(v.publishedAt).getTime() >= cutoff);
    }
    if (videoCampaignFilter !== "all") list = list.filter((v) => v.campaignId === videoCampaignFilter);
    if (videoCreatorFilter !== "all") list = list.filter((v) => v.creatorId === videoCreatorFilter);
    if (videoFormatFilter !== "all") list = list.filter((v) => v.contentTag === videoFormatFilter);
    if (videoSearch.trim()) {
      const q = videoSearch.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.username.toLowerCase().includes(q) ||
          v.creatorName.toLowerCase().includes(q) ||
          v.campaignName.toLowerCase().includes(q),
      );
    }
    return list.length;
  }, [data, videoCampaignFilter, videoCreatorFilter, videoFormatFilter, videoPeriodFilter, videoSearch]);

  const insights = useMemo(() => {
    if (!data) return [];
    const items: { emoji: string; title: string; text: string }[] = [];

    if (data.viralVideos[0]) {
      const v = data.viralVideos[0];
      items.push({
        emoji: "🔥",
        title: `Video esploso: @${cleanUsername(v.username)}`,
        text: `${formatViews(Math.round(v.viralVelocity))} views/giorno — ${formatViews(v.views)} views totali`,
      });
    }

    const bestEng = [...(data.creatorRankingDetailed ?? [])].sort((a, b) => b.engagementRate - a.engagementRate)[0];
    if (bestEng && bestEng.engagementRate > 0) {
      items.push({
        emoji: "💬",
        title: `Engagement: ${bestEng.creatorName}`,
        text: `Tasso di engagement ${bestEng.engagementRate.toFixed(2)}% — il più alto del periodo.`,
      });
    }

    const bestQS = [...(data.creatorRankingDetailed ?? [])].sort((a, b) => b.qualityScore - a.qualityScore)[0];
    if (bestQS && bestQS.qualityScore > 0) {
      items.push({
        emoji: "⭐",
        title: `Qualità: ${bestQS.creatorName}`,
        text: `Quality score ${bestQS.qualityScore.toFixed(1)} — più saves e shares.`,
      });
    }

    if (data.formatStats.length >= 2) {
      const best = data.formatStats[0];
      const worst = data.formatStats[data.formatStats.length - 1];
      items.push({
        emoji: "📐",
        title: `Formato top: "${best.tag}"`,
        text: `Media ${formatViews(best.avgViews)} views vs ${formatViews(worst.avgViews)} di "${worst.tag}".`,
      });
    }

    const bestCamp = [...data.campaigns].sort((a, b) => b.views - a.views)[0];
    if (bestCamp) {
      const pct = trendPercent(bestCamp.views, bestCamp.prevViews);
      if (pct > 0)
        items.push({ emoji: "📈", title: `${bestCamp.name} in crescita`, text: `+${pct}% di views rispetto al periodo precedente.` });
    }

    const inactive = data.creatorRanking.filter((c) => c.dailyViews.every((v) => v === 0));
    if (inactive.length > 0)
      items.push({ emoji: "⚠️", title: `${inactive.length} creator inattivi`, text: `Nessun contenuto pubblicato negli ultimi 7 giorni.` });

    if (data.publishedContent > 0) {
      const avg = Math.round(data.totalViews / data.publishedContent);
      items.push({ emoji: "📊", title: "Media views/video", text: `${formatViews(avg)} views per contenuto nel periodo selezionato.` });
    }

    return items;
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) return null;

  const viralCount = data.viralVideos.filter((v) => v.viralVelocity >= 10_000).length;

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

      {/* ROW 1 — KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Eye className="h-4 w-4" /> Views
            </div>
            <p className="text-2xl font-bold text-foreground">{formatViews(data.totalViews)}</p>
            <TrendBadge current={data.totalViews} prev={data.prevTotalViews} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-4 w-4" /> Creator attivi
            </div>
            <p className="text-2xl font-bold text-foreground">{data.activeCreators}</p>
            <TrendBadge current={data.activeCreators} prev={data.prevActiveCreators} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-4 w-4" /> Contenuti
            </div>
            <p className="text-2xl font-bold text-foreground">{data.publishedContent}</p>
            <TrendBadge current={data.publishedContent} prev={data.prevPublishedContent} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-4 w-4" /> Eng. Rate
            </div>
            <p className="text-2xl font-bold text-foreground">{data.avgEngagementRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">media periodo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BarChart3 className="h-4 w-4" /> Quality Score
            </div>
            <p className="text-2xl font-bold text-foreground">{data.avgQualityScore.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">saves+shares peso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Flame className="h-4 w-4" /> Video virali
            </div>
            <p className="text-2xl font-bold text-foreground">{viralCount}</p>
            <p className="text-xs text-muted-foreground">&gt;10K views/giorno</p>
          </CardContent>
        </Card>
      </div>

      {/* ROW 2 — Video Esplosi */}
      {data.viralVideos.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" /> Video Esplosi
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              ordinati per views/giorno — tutti i video attivi
            </p>
            <div className="space-y-3">
              {data.viralVideos.map((v, i) => (
                <div key={v.videoId} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xl font-bold text-muted-foreground shrink-0">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <a
                          href={`https://www.tiktok.com/@${cleanUsername(v.username)}/video/${v.tiktokVideoId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1 font-medium"
                        >
                          @{cleanUsername(v.username)} <ExternalLink className="h-3 w-3" />
                        </a>
                        <ViralBadge velocity={v.viralVelocity} />
                        <DurationBadge sec={v.durationSec} />
                        {v.contentTag && <Badge variant="secondary" className="text-xs">{v.contentTag}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {v.creatorName} • {v.campaignName} • {new Date(v.publishedAt).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 md:gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Views/giorno</p>
                      <p className="text-sm font-bold text-foreground">{formatViews(Math.round(v.viralVelocity))}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Views tot</p>
                      <p className="text-sm font-bold text-foreground">{formatViews(v.views)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Eng. %</p>
                      <p className="text-sm font-bold text-foreground">{v.engagementRate.toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Quality</p>
                      <p className="text-sm font-bold text-foreground">{v.qualityScore.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROW 3 — Chart full-width */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Views pubblicate per giorno</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Somma views dei video pubblicati ogni giorno
                {chartCampaigns.length > 0
                  ? ` · ${chartCampaigns.length} ${chartCampaigns.length === 1 ? "campagna" : "campagne"} selezionate`
                  : " · tutte le campagne"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs gap-2">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {chartCampaigns.length === 0
                      ? "Tutte le campagne"
                      : `${chartCampaigns.length} selezionate`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                    <span className="text-xs font-medium text-foreground">Campagne</span>
                    {chartCampaigns.length > 0 && (
                      <button
                        onClick={() => setChartCampaigns([])}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-0.5">
                    {chartCampaignNames.map((name) => {
                      const checked = chartCampaigns.includes(name);
                      return (
                        <label
                          key={name}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setChartCampaigns((prev) =>
                                v ? [...prev, name] : prev.filter((n) => n !== name)
                              );
                            }}
                          />
                          <span className="text-foreground truncate">{name}</span>
                        </label>
                      );
                    })}
                    {chartCampaignNames.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nessuna campagna</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Totale</p>
                <p className="text-lg font-bold text-foreground">{formatViews(chartTotalViews)}</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <AreaChart data={dailyTotals} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatViews(v)}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(v: number) => [formatViews(v), "Views"]}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#viewsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ROW 3b — Campaign summary full-width */}
      <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Campagne: riepilogo</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Quota di views sul totale del periodo</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...data.campaigns]
                .sort((a, b) => b.views - a.views)
                .map((camp) => {
                  const share = totalPeriodViews > 0 ? (camp.views / totalPeriodViews) * 100 : 0;
                  return (
                    <button
                      key={camp.id}
                      onClick={() => { setVideoCampaignFilter(camp.id); setVideoCreatorFilter("all"); setShowAllVideos(false); }}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-foreground">{camp.name}</span>
                        <TrendBadge current={camp.views} prev={camp.prevViews} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{formatViews(camp.views)} views · {camp.activeCreators} creator</span>
                        <span className="font-medium text-foreground">{share.toFixed(1)}%</span>
                      </div>
                      <Progress value={share} className="h-1.5" />
                    </button>
                  );
                })}
              {data.campaigns.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 md:col-span-2">Nessuna campagna attiva</p>
              )}
            </div>
          </CardContent>
        </Card>

      {/* ROW 5 — Video List */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Esplora Video per KPI</h2>
                <p className="text-xs text-muted-foreground">
                  Scegli un KPI e filtra per campagna, creator o formato. Ordinamento automatico in base al KPI selezionato.
                </p>
              </div>
              <Badge variant="secondary" className="self-start sm:self-auto">
                {totalFilteredVideos} video
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 mt-3">
              <div className="lg:col-span-2">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground block mb-1">KPI</label>
                <Select value={videoSort} onValueChange={(v: any) => { setVideoSort(v); setShowAllVideos(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">👁 Visualizzazioni</SelectItem>
                    <SelectItem value="comments">💬 Commenti</SelectItem>
                    <SelectItem value="likes">❤️ Like</SelectItem>
                    <SelectItem value="saves">🔖 Saves</SelectItem>
                    <SelectItem value="shares">↗️ Shares</SelectItem>
                    <SelectItem value="engagement">📊 Engagement %</SelectItem>
                    <SelectItem value="velocity">🔥 Views / giorno</SelectItem>
                    <SelectItem value="quality">⭐ Quality Score</SelectItem>
                    <SelectItem value="date">📅 Data pubblicazione</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground block mb-1">Campagna</label>
                <Select value={videoCampaignFilter} onValueChange={(v) => { setVideoCampaignFilter(v); setShowAllVideos(false); }}>
                  <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le campagne</SelectItem>
                    {data.campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground block mb-1">Creator</label>
                <Select value={videoCreatorFilter} onValueChange={(v) => { setVideoCreatorFilter(v); setShowAllVideos(false); }}>
                  <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i creator</SelectItem>
                    {creatorOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground block mb-1">Formato</label>
                <Select value={videoFormatFilter} onValueChange={(v) => { setVideoFormatFilter(v); setShowAllVideos(false); }}>
                  <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i formati</SelectItem>
                    {(formats ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground block mb-1">
                  Soglia min. KPI
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="es. 1000"
                  value={minKpiValue}
                  onChange={(e) => { setMinKpiValue(e.target.value); setShowAllVideos(false); }}
                  disabled={videoSort === "date"}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Input
                placeholder="Cerca per @account, creator o campagna…"
                value={videoSearch}
                onChange={(e) => { setVideoSearch(e.target.value); setShowAllVideos(false); }}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVideoCampaignFilter("all");
                  setVideoCreatorFilter("all");
                  setVideoFormatFilter("all");
                  setVideoSort("views");
                  setMinKpiValue("");
                  setVideoSearch("");
                  setShowAllVideos(false);
                }}
              >
                <X className="h-4 w-4 mr-1" /> Reset filtri
              </Button>
            </div>
          </div>

          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video / Account</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Campagna</TableHead>
                  <TableHead className="text-right">Views/gg</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Eng. %</TableHead>
                  <TableHead className="text-right">Saves</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                  <TableHead>Durata</TableHead>
                  <TableHead>Tag formato</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedVideos.map((v) => (
                  <TableRow key={v.videoId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.tiktok.com/@${cleanUsername(v.username)}/video/${v.tiktokVideoId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          @{cleanUsername(v.username)} <ExternalLink className="h-3 w-3" />
                        </a>
                        <ViralBadge velocity={v.viralVelocity} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{v.creatorName}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{v.campaignName}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatViews(Math.round(v.viralVelocity))}</TableCell>
                    <TableCell className="text-right font-bold">{formatViews(v.views)}</TableCell>
                    <TableCell className="text-right">{v.engagementRate.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{v.saves !== null ? formatViews(v.saves) : "—"}</TableCell>
                    <TableCell className="text-right">{v.shares !== null ? formatViews(v.shares) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <span className={v.qualityScore > 0 ? "font-semibold text-primary" : "text-muted-foreground"}>
                        {v.qualityScore.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell><DurationBadge sec={v.durationSec} /></TableCell>
                    <TableCell>
                      <ContentTagCell
                        video={v}
                        formats={formats ?? []}
                        onSave={(tag) => saveTag.mutate({ videoId: v.videoId, tag })}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(v.publishedAt).toLocaleDateString("it-IT")}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedVideos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-8">Nessun video trovato</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {!showAllVideos && totalFilteredVideos > 30 && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowAllVideos(true)}>
                Mostra tutti ({totalFilteredVideos})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROW 6 — Format performance */}
      {data.formatStats.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Performance per Formato
            </h2>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Formato / Tag</TableHead>
                    <TableHead className="text-right">Video</TableHead>
                    <TableHead className="text-right">Media Views</TableHead>
                    <TableHead className="text-right">Media Eng. %</TableHead>
                    <TableHead className="text-right">Media Quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.formatStats.map((f) => (
                    <TableRow key={f.tag}>
                      <TableCell className="font-medium">{f.tag}</TableCell>
                      <TableCell className="text-right">{f.videoCount}</TableCell>
                      <TableCell className="text-right font-semibold">{formatViews(f.avgViews)}</TableCell>
                      <TableCell className="text-right">{f.avgEngagement.toFixed(2)}%</TableCell>
                      <TableCell className="text-right text-primary font-semibold">{f.avgQualityScore.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ROW 7 — Gestione Formati */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plus className="h-5 w-5" /> Gestione Formati
          </h2>
          <div className="flex gap-2 mb-4">
            <Input
              value={newFormatName}
              onChange={(e) => setNewFormatName(e.target.value)}
              placeholder="Nuovo formato (es. Direct Hook)"
              className="max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFormatName.trim()) {
                  addFormat.mutate(newFormatName.trim());
                  setNewFormatName("");
                }
              }}
            />
            <Button
              onClick={() => {
                if (newFormatName.trim()) {
                  addFormat.mutate(newFormatName.trim());
                  setNewFormatName("");
                }
              }}
            >
              Aggiungi
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(formats ?? []).map((f) => (
              <div
                key={f.id}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border bg-muted/50 text-sm"
              >
                <span>{f.name}</span>
                <button
                  onClick={() => deleteFormat.mutate(f.id)}
                  title="Elimina formato"
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {!(formats ?? []).length && (
              <p className="text-sm text-muted-foreground">Nessun formato definito.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ROW 8 — Insights */}
      {insights.length > 0 && (
        <div className="bg-muted/50 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" /> Insights automatici
          </h2>
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

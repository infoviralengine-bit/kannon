import { useMemo, useState } from "react";
import { AtSign, Bookmark, Eye, Film, Heart, MessageCircle, Percent, Share2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/operator/MultiSelectFilter";
import { OperatorKpi } from "@/components/operator/OperatorKpi";
import { OperatorViewsChart } from "@/components/operator/OperatorViewsChart";
import { OperatorBreakdown } from "@/components/operator/OperatorBreakdown";
import { OperatorVideoTable } from "@/components/operator/OperatorVideoTable";
import { useOperatorAnalytics, useOperatorCampaigns, useOperatorFilterOptions, type OperatorFilters } from "@/hooks/useOperatorData";
import { formatViews } from "@/lib/format";
import { isoDaysAgo, todayIso } from "@/lib/operatorDates";
import { useI18n } from "@/i18n";

const PRESETS = [7, 30, 90] as const;
const ALL = "__all__";

export default function OperatorVideosPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(todayIso());
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [creatorIds, setCreatorIds] = useState<string[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [format, setFormat] = useState<string>(ALL);
  const [win, setWin] = useState<string>(ALL);
  const [minViews, setMinViews] = useState<string>("");

  const { data: campaigns } = useOperatorCampaigns();
  const { data: opts } = useOperatorFilterOptions();

  const activeIds = useMemo(() => new Set((campaigns ?? []).map((c) => c.id)), [campaigns]);
  const accountOptions = useMemo(() => (opts?.accounts ?? [])
    .filter((a) => a.campaign_id && activeIds.has(a.campaign_id))
    .filter((a) => !campaignIds.length || campaignIds.includes(a.campaign_id!))
    .filter((a) => !creatorIds.length || (a.creator_id && creatorIds.includes(a.creator_id)))
    .map((a) => ({ id: a.id, label: `@${a.username.replace(/^@+/, "")}` })), [opts, activeIds, campaignIds, creatorIds]);

  const filters: OperatorFilters = useMemo(() => ({
    from: from || null, to: to || null, campaignIds, creatorIds, accountIds,
    format: format === ALL ? null : format,
    window: win === ALL ? null : (win as OperatorFilters["window"]),
    minViews: minViews ? Math.max(0, Number(minViews)) : null,
  }), [from, to, campaignIds, creatorIds, accountIds, format, win, minViews]);

  const { data, isLoading } = useOperatorAnalytics(filters);
  const k = data?.kpis;
  const days = from && to ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1 : 0;

  const reset = () => {
    setFrom(isoDaysAgo(29)); setTo(todayIso()); setCampaignIds([]); setCreatorIds([]);
    setAccountIds([]); setFormat(ALL); setWin(ALL); setMinViews("");
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Analisi video")}</h1>

      <Card className="sticky -top-6 z-20 -mt-2">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <Button key={p} size="sm" variant={days === p && to === todayIso() ? "default" : "outline"} className="h-9"
                onClick={() => { setFrom(isoDaysAgo(p - 1)); setTo(todayIso()); }}>
                {t(`${p}gg`)}
              </Button>
            ))}
            <Button size="sm" variant={!from ? "default" : "outline"} className="h-9" onClick={() => { setFrom(""); setTo(""); }}>
              {t("Tutto")}
            </Button>
          </div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[140px] text-xs" aria-label={t("Dal")} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[140px] text-xs" aria-label={t("Al")} />
          <MultiSelectFilter label={t("Campagne")} value={campaignIds} onChange={setCampaignIds}
            options={(campaigns ?? []).map((c) => ({ id: c.id, label: c.name }))} />
          <MultiSelectFilter label={t("Creator")} value={creatorIds} onChange={setCreatorIds}
            options={(opts?.creators ?? []).map((c) => ({ id: c.id, label: c.name }))} />
          <MultiSelectFilter label={t("Account")} value={accountIds} onChange={setAccountIds} options={accountOptions} />
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("Tutti i format")}</SelectItem>
              {(opts?.formats ?? []).map((f) => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={win} onValueChange={setWin}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("Tutte le finestre")}</SelectItem>
              <SelectItem value="open">{t("Aperta")}</SelectItem>
              <SelectItem value="closing">{t("In chiusura")}</SelectItem>
              <SelectItem value="closed">{t("Chiusa")}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" min={0} value={minViews} onChange={(e) => setMinViews(e.target.value)}
            placeholder={t("Views minime")} className="h-9 w-[130px] text-xs" />
          <Button variant="ghost" size="sm" className="h-9" onClick={reset}>{t("Azzera filtri")}</Button>
        </CardContent>
      </Card>

      <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 ${isLoading ? "opacity-60" : ""}`}>
        <OperatorKpi icon={Eye} label={t("Views")} value={formatViews(Number(k?.views ?? 0))} />
        <OperatorKpi icon={Film} label={t("Video")} value={formatViews(Number(k?.videos ?? 0))} />
        <OperatorKpi icon={TrendingUp} label={t("Media views per video")} value={formatViews(Number(k?.avg_views ?? 0))} />
        <OperatorKpi icon={Percent} label={t("Engagement")} value={`${Number(k?.engagement_pct ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`} />
        <OperatorKpi icon={Heart} label={t("Like")} value={formatViews(Number(k?.likes ?? 0))} />
        <OperatorKpi icon={MessageCircle} label={t("Commenti")} value={formatViews(Number(k?.comments ?? 0))} />
        <OperatorKpi icon={Share2} label={t("Condivisioni")} value={formatViews(Number(k?.shares ?? 0))} />
        <OperatorKpi icon={Bookmark} label={t("Salvataggi")} value={formatViews(Number(k?.saves ?? 0))} />
        <OperatorKpi icon={AtSign} label={t("Account con video")} value={formatViews(Number(k?.accounts ?? 0))} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Views per giorno di pubblicazione")}</CardTitle></CardHeader>
        <CardContent>
          {data && data.daily.length > 0 ? (
            <OperatorViewsChart
              daily={data.daily}
              from={from || data.daily[0].date}
              to={to || data.daily[data.daily.length - 1].date}
            />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">{t("Nessun dato")}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <OperatorBreakdown title={t("Campagne")} rows={data?.by_campaign ?? []} />
        <OperatorBreakdown title={t("Top creator")} rows={data?.by_creator ?? []} />
        <OperatorBreakdown title={t("Top account")} rows={data?.by_account ?? []} prefix="@" />
        <OperatorBreakdown title={t("Format")} rows={data?.by_format ?? []} />
      </div>

      <OperatorVideoTable filters={filters} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContentAnalytics, useCampaignOptions } from "@/hooks/useContentCalendar";
import { useVideoFormats, useContentTopics } from "@/hooks/useContentCatalog";
import { KPIStrip } from "./KPIStrip";
import { DailyViewsChart } from "./DailyViewsChart";
import {
  CampaignsTable,
  CreatorRankingTable,
  FormatStatsTable,
  TopicStatsTable,
  ViralVideosTable,
} from "./AnalyticsTables";
import { VideoListWithTagging } from "./VideoListWithTagging";

const PERIODS = ["7d", "30d", "90d"] as const;
const ALL = "__all__";

export default function CampaignAnalyticsTab({ campaignId }: { campaignId: string | null }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("30d");
  const [campaignFilter, setCampaignFilter] = useState<string>(campaignId ?? ALL);
  const [formatId, setFormatId] = useState<string>(ALL);
  const [topicId, setTopicId] = useState<string>(ALL);

  useEffect(() => {
    if (campaignId) setCampaignFilter(campaignId);
  }, [campaignId]);

  const { data: campaigns } = useCampaignOptions();
  const { data: formats } = useVideoFormats();
  const { data: topics } = useContentTopics();

  const { data, isLoading } = useContentAnalytics(
    period,
    campaignFilter === ALL ? null : campaignFilter,
    formatId === ALL ? null : formatId,
    topicId === ALL ? null : topicId
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>{p}</Button>
          ))}
        </div>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Campagna" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutte le campagne</SelectItem>
            {(campaigns ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={formatId} onValueChange={setFormatId}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Format" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutti i format</SelectItem>
            {(formats ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={topicId} onValueChange={setTopicId}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Topic" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutti i topic</SelectItem>
            {(topics ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <KPIStrip data={data} />
          <DailyViewsChart data={data} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CampaignsTable data={data} />
            <CreatorRankingTable data={data} />
            <FormatStatsTable data={data} />
            <TopicStatsTable data={data} />
          </div>
          <ViralVideosTable data={data} />
          <VideoListWithTagging data={data} />
        </>
      )}
    </div>
  );
}

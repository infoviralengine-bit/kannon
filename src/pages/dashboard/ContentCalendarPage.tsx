import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import CalendarTab from "@/components/content-calendar/CalendarTab";
import InsightsTab from "@/components/content-calendar/InsightsTab";
import CatalogTab from "@/components/content-calendar/CatalogTab";
import CampaignAnalyticsTab from "@/components/content-calendar/analytics/CampaignAnalyticsTab";
import { useCampaignOptions } from "@/hooks/useContentCalendar";
import { ScrapingStatusBanner } from "@/components/scraping/ScrapingStatusBanner";

const STORAGE_KEY = "content-calendar:campaign";
const TABS = ["calendario", "analytics", "insights", "catalog"] as const;
type TabKey = (typeof TABS)[number];

export default function ContentCalendarPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") as TabKey | null;
  const tab: TabKey = tabParam && TABS.includes(tabParam) ? tabParam : "calendario";

  const { data: campaigns } = useCampaignOptions();
  const [campaignId, setCampaignId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  // Default to first campaign once loaded if none persisted/valid.
  useEffect(() => {
    if (!campaigns || campaigns.length === 0) return;
    const valid = campaignId && campaigns.some((c) => c.id === campaignId);
    if (!valid) {
      setCampaignId(campaigns[0].id);
    }
  }, [campaigns, campaignId]);

  useEffect(() => {
    if (campaignId) localStorage.setItem(STORAGE_KEY, campaignId);
  }, [campaignId]);

  const setTab = (next: string) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  const needsCampaign = tab === "calendario" || tab === "insights";
  const campaignName = useMemo(
    () => campaigns?.find((c) => c.id === campaignId)?.name ?? null,
    [campaigns, campaignId]
  );

  return (
    <div className="space-y-4">
      <ScrapingStatusBanner />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Calendario Contenuti</h1>
        </div>
        <Select value={campaignId ?? undefined} onValueChange={setCampaignId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Seleziona campagna" />
          </SelectTrigger>
          <SelectContent>
            {(campaigns ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {needsCampaign && !campaignId ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                {campaignName === null && (campaigns?.length ?? 0) === 0
                  ? "Nessuna campagna disponibile."
                  : "Seleziona una campagna per continuare."}
              </CardContent>
            </Card>
          ) : (
            <>
              <TabsContent value="calendario">
                {campaignId && <CalendarTab campaignId={campaignId} campaignName={campaignName} />}
              </TabsContent>
              <TabsContent value="analytics">
                <CampaignAnalyticsTab campaignId={campaignId} />
              </TabsContent>
              <TabsContent value="insights">
                {campaignId && <InsightsTab campaignId={campaignId} />}
              </TabsContent>
              <TabsContent value="catalog">
                <CatalogTab />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

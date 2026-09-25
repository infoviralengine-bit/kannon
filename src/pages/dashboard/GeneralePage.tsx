import { useState } from "react";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import OperationalStatusBar from "@/components/dashboard/OperationalStatusBar";
import CampaignTimeline from "@/components/dashboard/CampaignTimeline";
import ViewsPerformancePanel from "@/components/dashboard/ViewsPerformancePanel";
import PipelineSummaryPanel from "@/components/dashboard/PipelineSummaryPanel";

/**
 * Command Center: stato operativo, timeline campagne attive,
 * performance views filtrabile e sintesi pipeline clienti.
 */
export default function GeneralePage() {
  const { t } = useI18n();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Command Center")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("Panoramica in tempo reale")}</p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-border text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {t("Aggiornamento automatico")}
        </Badge>
      </div>

      <OperationalStatusBar />

      <CampaignTimeline selectedId={selectedCampaign} onSelect={setSelectedCampaign} />

      <ViewsPerformancePanel campaignId={selectedCampaign} onCampaignChange={setSelectedCampaign} />

      <PipelineSummaryPanel />
    </div>
  );
}

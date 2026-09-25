import { useState } from "react";
import { useI18n } from "@/i18n";
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
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Command Center")}</h1>

      <CampaignTimeline selectedId={selectedCampaign} onSelect={setSelectedCampaign} />

      <ViewsPerformancePanel campaignId={selectedCampaign} onCampaignChange={setSelectedCampaign} />

      <PipelineSummaryPanel />

      <OperationalStatusBar />
    </div>
  );
}

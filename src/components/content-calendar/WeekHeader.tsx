import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { addDays, formatDateIt, toISODate } from "./_helpers";
import { useBulkLoadWeek, type Brief } from "@/hooks/useContentCalendar";
import { useI18n } from "@/i18n";

export function WeekHeader({
  weekStart,
  briefs,
  campaignId,
}: {
  weekStart: string;
  briefs: Brief[];
  campaignId: string;
}) {
  const { t } = useI18n();
  const bulkLoad = useBulkLoadWeek();
  const draftCount = briefs.filter((b) => b.status === "draft").length;
  const start = new Date(weekStart);
  const end = addDays(start, 6);

  const onLoad = async () => {
    try {
      const n = await bulkLoad.mutateAsync({
        campaignId,
        weekStart,
        weekEnd: toISODate(end),
      });
      toast({ title: t("Settimana caricata"), description: t("{n} brief in revisione, creator e cliente notificati.", { n }) });
    } catch (e: any) {
      toast({ title: t("Errore"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between pb-1">
      <h3 className="text-sm font-semibold text-foreground">
        {t("Settimana del {start} - {end}", { start: formatDateIt(start), end: formatDateIt(end) })}
      </h3>
      <Button
        size="sm"
        variant="outline"
        disabled={draftCount === 0 || bulkLoad.isPending}
        onClick={onLoad}
      >
        <Upload className="h-3.5 w-3.5 mr-1" />
        {t("Carica settimana ({n} bozze)", { n: draftCount })}
      </Button>
    </div>
  );
}

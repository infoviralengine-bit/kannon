import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useVideoAnalytics,
  useStartScraping,
  useScrapingStatus,
  useLastScrapeLog,
  type VideoAnalyticsFilters as Filters,
} from "@/hooks/useVideoAnalytics";
import { ScrapingStatusBanner } from "@/components/scraping/ScrapingStatusBanner";
import { VideoAnalyticsFilters } from "@/components/video-analytics/VideoAnalyticsFilters";
import { VideoAnalyticsKPIs } from "@/components/video-analytics/VideoAnalyticsKPIs";
import { VideoTimeSeriesChart } from "@/components/video-analytics/VideoTimeSeriesChart";
import { TopBreakdownChart } from "@/components/video-analytics/TopBreakdownChart";
import { TopVideosTable } from "@/components/video-analytics/TopVideosTable";
import { isStaff, ROLES } from "@/lib/roles";

function defaultFilters(): Filters {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to };
}

export default function VideoAnalyticsPage() {
  const { role } = useAuth();
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const { data, isLoading, error } = useVideoAnalytics(filters);
  const startScraping = useStartScraping();
  const { data: scrapeLog } = useScrapingStatus();
  const { data: lastLog } = useLastScrapeLog();
  const { toast } = useToast();
  const isRunning =
    scrapeLog?.status === "running" &&
    (!scrapeLog.started_at ||
      Date.now() - new Date(scrapeLog.started_at).getTime() < 5 * 60 * 1000);

  if (role && !isStaff(role) && role !== ROLES.CAMPAIGN_MANAGER)
    return <Navigate to="/dashboard" replace />;

  const handleRefresh = async () => {
    try {
      await startScraping.mutateAsync();
      toast({
        title: "Refresh avviato",
        description: "Lo scraping TikTok è partito. Lo stato si aggiorna in tempo reale qui sopra.",
      });
    } catch (e: any) {
      toast({ title: "Errore refresh", description: e.message, variant: "destructive" });
    }
  };

  const lastScrapeLabel = lastLog?.run_at
    ? `Ultimo refresh ${new Date(lastLog.run_at).toLocaleString("it-IT")} (${lastLog.status})`
    : "Nessun refresh registrato";

  return (
    <div className="space-y-6">
      <ScrapingStatusBanner />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Video Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">{lastScrapeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VideoAnalyticsFilters value={filters} onChange={setFilters} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isRunning || startScraping.isPending} className="gap-2">
                {isRunning || startScraping.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isRunning ? "Scraping in corso..." : "Refresh dati"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Avviare il refresh dei dati TikTok?</AlertDialogTitle>
                <AlertDialogDescription>
                  Lo scraping completo di tutti gli account creator attivi può richiedere alcuni minuti
                  e consuma quota Apify. Procedere solo se è davvero necessario aggiornare ora.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleRefresh}>
                  Sì, avvia refresh
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-80" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      ) : (
        <>
          <VideoAnalyticsKPIs kpi={data.kpi} windowStats={data.window_stats} />
          <VideoTimeSeriesChart data={data.by_day} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopBreakdownChart title="Top campagne" data={data.by_campaign as any} nameKey="campaign_name" />
            <TopBreakdownChart title="Top creator" data={data.by_creator as any} nameKey="creator_name" />
          </div>
          <TopVideosTable filters={filters} />
        </>
      )}
    </div>
  );
}
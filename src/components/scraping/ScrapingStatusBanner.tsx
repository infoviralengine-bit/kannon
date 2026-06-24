import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { useScrapingStatus, useRecoverScraping } from "@/hooks/useVideoAnalytics";
import { toast } from "@/hooks/use-toast";

export function ScrapingStatusBanner() {
  const { data: log } = useScrapingStatus();
  const recover = useRecoverScraping();
  const lastStatus = useRef<string | null>(null);
  const autoRecoveredFor = useRef<string | null>(null);
  const qc = useQueryClient();
  const [, force] = useState(0);

  // Tick every second so the elapsed counter advances while running.
  useEffect(() => {
    if (log?.status !== "running") return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [log?.status]);

  // Auto-recover once per stale running log (best effort, silent).
  useEffect(() => {
    if (!log || log.status !== "running" || !log.started_at) return;
    const elapsedMs = Date.now() - new Date(log.started_at).getTime();
    if (elapsedMs < 5 * 60 * 1000) return;
    if (autoRecoveredFor.current === log.id) return;
    autoRecoveredFor.current = log.id;
    recover.mutate(5, {
      onSuccess: (r) => {
        if (r?.recovered > 0) {
          toast({
            title: "Scraping sbloccato",
            description: "Run bloccata recuperata automaticamente.",
          });
        }
      },
      onError: () => { /* user can retry via the button below */ },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log?.id, log?.started_at, log?.status]);

  useEffect(() => {
    if (!log) return;
    if (lastStatus.current === "running" && log.status === "success") {
      toast({
        title: "Scraping completato",
        description: `${log.videos_created} nuovi video, ${log.videos_updated} aggiornati.`,
      });
      qc.invalidateQueries({ queryKey: ["video-analytics"] });
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["videos_for_accounts"] });
      qc.invalidateQueries({ queryKey: ["content-calendar"] });
      qc.invalidateQueries({ queryKey: ["last-scrape-log"] });
    } else if (lastStatus.current === "running" && log.status === "error") {
      toast({
        title: "Scraping fallito",
        description: log.error_message ?? "Errore sconosciuto. Vedi log.",
        variant: "destructive",
      });
    }
    lastStatus.current = log.status;
  }, [log, qc]);

  if (!log || log.status !== "running") return null;

  const elapsed = log.started_at
    ? Math.round((Date.now() - new Date(log.started_at).getTime()) / 1000)
    : 0;

  const isStale = elapsed > 5 * 60;

  return (
    <Alert variant={isStale ? "destructive" : "default"}>
      {isStale ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <AlertTitle>
        {isStale ? "Scraping bloccato" : "Scraping in corso"}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
        <span>
          {log.progress_note ?? "In attesa di aggiornamenti..."}
          <span className="text-xs text-muted-foreground ml-2">({elapsed}s)</span>
          {isStale && (
            <span className="block text-xs mt-1 opacity-90">
              Il poller in background si è interrotto. Sblocco automatico in corso, oppure forza qui sotto.
            </span>
          )}
        </span>
        {isStale && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => recover.mutate(5)}
            disabled={recover.isPending}
          >
            {recover.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : null}
            Sblocca e recupera
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

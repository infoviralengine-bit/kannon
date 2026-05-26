import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ora";
  if (min < 60) return `${min}m fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}

export function LastUpdateBadge() {
  const { role } = useAuth();
  const eligible = role === "admin" || role === "team" || role === "campaign_manager";

  const { data } = useQuery({
    queryKey: ["last-scrape-at"],
    enabled: eligible,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_last_scrape_at");
      if (error) throw error;
      return data as string | null;
    },
  });

  if (!eligible) return null;

  const tooltip = data ? new Date(data).toLocaleString("it-IT") : "Mai";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/40 cursor-default">
            <RefreshCw className="h-3 w-3" />
            <span>Aggiornato {formatRelative(data ?? null)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Ultimo scraping: {tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
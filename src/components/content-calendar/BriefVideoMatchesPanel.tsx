import { useState } from "react";
import { ExternalLink, Plus, RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/format";
import {
  useBrief,
  useRemoveMatch,
  useManualMatch,
  useRefreshMatching,
  useCampaignVideosSearch,
  type Brief,
} from "@/hooks/useContentCalendar";
import { useI18n } from "@/i18n";

const METHOD_LABEL: Record<string, string> = {
  audio_id: "Audio",
  caption_keywords: "Caption",
  manual: "Manuale",
};

export function BriefVideoMatchesPanel({ briefId, brief }: { briefId: string; brief: Brief | null }) {
  const { t } = useI18n();
  const { data, isLoading } = useBrief(briefId);
  const removeMatch = useRemoveMatch();
  const refresh = useRefreshMatching();
  const [searchOpen, setSearchOpen] = useState(false);
  const matches = data?.matches ?? [];

  const onRefresh = async () => {
    try {
      const n = await refresh.mutateAsync(30);
      toast({ title: t("Matching aggiornato"), description: t("{n} nuovi match.", { n }) });
    } catch (e: any) {
      toast({ title: t("Errore"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t("Video matchati ({n})", { n: matches.length })}</h4>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={refresh.isPending}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />{t("Aggiorna")}
          </Button>
          <Button size="sm" onClick={() => setSearchOpen(true)} disabled={!brief}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t("Match manuale")}
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t("Caricamento...")}</p>}
      {!isLoading && matches.length === 0 && <p className="text-sm text-muted-foreground">{t("Nessun video matchato.")}</p>}

      {matches.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Account")}</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">{t("Eng. %")}</TableHead>
              <TableHead>{t("Metodo")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <a href={m.tiktok_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                    @{m.account_username ?? "?"} <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell className="text-right">{formatViews(m.effective_views)}</TableCell>
                <TableCell className="text-right">{m.engagement_pct.toFixed(1)}%</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px]">{METHOD_LABEL[m.match_method] ?? m.match_method}</Badge></TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => removeMatch.mutate({ videoId: m.video_id, briefId })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {brief && (
        <ManualMatchDialog open={searchOpen} onOpenChange={setSearchOpen} briefId={briefId} campaignId={brief.campaign_id} />
      )}
    </div>
  );
}

function ManualMatchDialog({
  open,
  onOpenChange,
  briefId,
  campaignId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  briefId: string;
  campaignId: string;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const { data: videos, isLoading } = useCampaignVideosSearch(campaignId, search);
  const manualMatch = useManualMatch();

  const add = async (videoId: string) => {
    try {
      await manualMatch.mutateAsync({ videoId, briefId });
      toast({ title: t("Match aggiunto") });
    } catch (e: any) {
      toast({ title: t("Errore"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("Aggiungi match manuale")}</DialogTitle></DialogHeader>
        <Input placeholder={t("Cerca nella caption...")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-80 overflow-y-auto space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground">{t("Caricamento...")}</p>}
          {(videos ?? []).map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">@{v.username ?? "?"}</p>
                <p className="text-xs text-muted-foreground truncate">{v.caption ?? t("(nessuna caption)")}</p>
                <p className="text-[10px] text-muted-foreground">{formatViews(v.views)} views</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => add(v.id)} disabled={manualMatch.isPending}>{t("Match")}</Button>
            </div>
          ))}
          {!isLoading && (videos ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("Nessun video trovato.")}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

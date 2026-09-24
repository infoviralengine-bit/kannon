import { ExternalLink, Pencil, Archive, CheckCircle2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/format";
import { STATUS_META, formatDateIt } from "./_helpers";
import { BriefCommentsThread } from "./BriefCommentsThread";
import { BriefChangeRequestsList } from "./BriefChangeRequestsList";
import { BriefVideoMatchesPanel } from "./BriefVideoMatchesPanel";
import {
  useChangeBriefStatus,
  useDeleteBrief,
  type Brief,
} from "@/hooks/useContentCalendar";
import { useI18n } from "@/i18n";

export function BriefDetailDrawer({
  brief,
  open,
  onOpenChange,
  onEdit,
}: {
  brief: Brief | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (brief: Brief) => void;
}) {
  const { t } = useI18n();
  const changeStatus = useChangeBriefStatus();
  const deleteBrief = useDeleteBrief();

  if (!brief) return null;
  const meta = STATUS_META[brief.status];

  const setStatus = async (status: Brief["status"]) => {
    try {
      await changeStatus.mutateAsync({ id: brief.id, status });
      toast({ title: status === "approved" ? t("Brief approvato") : t("Stato aggiornato") });
    } catch (e: any) {
      toast({ title: t("Errore"), description: e.message, variant: "destructive" });
    }
  };

  const onDelete = async () => {
    try {
      await deleteBrief.mutateAsync(brief.id);
      toast({ title: t("Brief eliminato") });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: t("Errore"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={meta.badge}>{meta.label}</Badge>
            {brief.is_winner && <Badge className="bg-emerald-500/15 text-emerald-600">{t("Winner")}</Badge>}
            <span className="text-xs text-muted-foreground">{formatDateIt(brief.planned_publish_date, { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <SheetTitle>{brief.title || t("Brief")}</SheetTitle>
          <div className="flex flex-wrap gap-2">
            {brief.status === "in_review" && (
              <Button size="sm" onClick={() => setStatus("approved")} disabled={changeStatus.isPending}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("Approva")}
              </Button>
            )}
            {brief.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => setStatus("in_review")} disabled={changeStatus.isPending}>
                {t("Metti in revisione")}
              </Button>
            )}
            {brief.status !== "archived" && (
              <Button size="sm" variant="outline" onClick={() => setStatus("archived")} disabled={changeStatus.isPending}>
                <Archive className="h-3.5 w-3.5 mr-1" />{t("Archivia")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onEdit(brief)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />{t("Modifica")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-red-500">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />{t("Elimina")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Eliminare questo brief?")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("L\'azione è irreversibile. I match associati verranno rimossi.")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Annulla")}</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>{t("Elimina")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetHeader>

        <Tabs defaultValue="detail" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detail">{t("Dettaglio")}</TabsTrigger>
            <TabsTrigger value="matches">{t("Match")} {brief.matched_videos_count > 0 ? `(${brief.matched_videos_count})` : ""}</TabsTrigger>
            <TabsTrigger value="comments">{t("Commenti")}</TabsTrigger>
            <TabsTrigger value="cr">{t("Modifiche")}</TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="space-y-3 text-sm">
            {brief.format_name && <Field label={t("Format")}><Badge variant="secondary">{brief.format_name}</Badge></Field>}
            {brief.topic_names.length > 0 && (
              <Field label={t("Topic")}>
                <div className="flex flex-wrap gap-1">{brief.topic_names.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
              </Field>
            )}
            {brief.reference_links.length > 0 && (
              <Field label={t("Riferimenti")}>
                <div className="flex flex-col gap-1">
                  {brief.reference_links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {l.label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </Field>
            )}
            <Field label={t("Copy")}><p className="whitespace-pre-wrap">{brief.copy_text}</p></Field>
            {brief.caption && <Field label={t("Caption")}><p className="whitespace-pre-wrap">{brief.caption}</p></Field>}
            {brief.hashtags.length > 0 && <Field label={t("Hashtag")}><p className="text-muted-foreground">{brief.hashtags.map((h) => `#${h}`).join(" ")}</p></Field>}
            {brief.visual_note && <Field label={t("Note visuali")}><p className="whitespace-pre-wrap">{brief.visual_note}</p></Field>}
            {brief.audio_id && <Field label={t("Audio ID")}><span className="text-muted-foreground">{brief.audio_id}</span></Field>}
            <Field label={t("Soglie")}>
              <span className="text-muted-foreground">
                {brief.threshold_views != null ? `${formatViews(brief.threshold_views)} views` : t("default")}
                {" · "}
                {brief.threshold_engagement != null ? t("{pct}% eng.", { pct: brief.threshold_engagement }) : ""}
              </span>
            </Field>
            {brief.matched_videos_count > 0 && (
              <Field label={t("Performance")}>
                <span>{t("{views} views, {pct}% eng. medio", { views: formatViews(brief.total_effective_views), pct: brief.avg_engagement_pct })}</span>
              </Field>
            )}
          </TabsContent>

          <TabsContent value="matches"><BriefVideoMatchesPanel briefId={brief.id} brief={brief} /></TabsContent>
          <TabsContent value="comments"><BriefCommentsThread briefId={brief.id} /></TabsContent>
          <TabsContent value="cr"><BriefChangeRequestsList briefId={brief.id} brief={brief} /></TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</p>
      {children}
    </div>
  );
}

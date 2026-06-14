import { ExternalLink, CheckCircle2, MessageSquare, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useChangeBriefStatus } from "@/hooks/useContentCalendar";
import { STATUS_META, formatDateIt } from "@/components/content-calendar/_helpers";
import type { PortalBrief } from "@/hooks/useClientBriefs";

export function ClientBriefCard({
  brief,
  onComment,
  onChangeRequest,
}: {
  brief: PortalBrief;
  onComment: (b: PortalBrief) => void;
  onChangeRequest: (b: PortalBrief) => void;
}) {
  const changeStatus = useChangeBriefStatus();
  const meta = STATUS_META[brief.status];

  const approve = async () => {
    try {
      await changeStatus.mutateAsync({ id: brief.id, status: "approved" });
      toast({ title: "Contenuto approvato", description: "Lo staff e i creator sono stati notificati." });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge className={meta.badge}>{meta.label}</Badge>
            {brief.has_pending_cr && <Badge className="bg-red-500/15 text-red-600">Modifica richiesta</Badge>}
          </div>
          <span className="text-sm text-muted-foreground">
            {formatDateIt(brief.planned_publish_date, { day: "numeric", month: "long" })}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-tight">{brief.title || "Brief"}</h3>
          <div className="flex flex-wrap gap-1">
            {brief.format_name && <Badge variant="secondary">{brief.format_name}</Badge>}
            {brief.topic_names.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>
        </div>

        {brief.reference_links.length > 0 && (
          <div className="flex flex-col gap-1">
            {brief.reference_links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                {l.label} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}

        <div className="space-y-2 text-sm">
          <Field label="Copy" value={brief.copy_text} />
          {brief.caption && <Field label="Caption" value={brief.caption} />}
          {brief.hashtags.length > 0 && <Field label="Hashtag" value={brief.hashtags.map((h) => `#${h}`).join(" ")} />}
          {brief.visual_note && <Field label="Note visuali" value={brief.visual_note} />}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {brief.status === "in_review" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={changeStatus.isPending}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approva
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approvare questo contenuto?</AlertDialogTitle>
                  <AlertDialogDescription>I creator potranno procedere con la pubblicazione.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={approve}>Approva</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button size="sm" variant="outline" onClick={() => onComment(brief)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" />Lascia commento
          </Button>
          {brief.status !== "archived" && (
            <Button size="sm" variant="outline" onClick={() => onChangeRequest(brief)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />Richiedi modifica
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}

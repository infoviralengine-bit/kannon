import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Link as LinkIcon, Calendar, Lock } from "lucide-react";
import { CreatorContentItem, useUpdateContentStatus } from "@/hooks/useCreatorPortal";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

interface Props {
  content: CreatorContentItem[];
  locked: boolean;
}

const typeBadgeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  script: { label: "Script", variant: "default" },
  brief: { label: "Brief", variant: "secondary" },
  esempio: { label: "Esempio", variant: "outline" },
};

export default function CreatorContent({ content, locked }: Props) {
  const { t } = useI18n();
  const updateStatus = useUpdateContentStatus();

  if (locked) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center space-y-2">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-semibold">🔒 {t("Disponibile dopo il warmup")}</p>
          <p className="text-sm text-muted-foreground">
            {t("Completa il warmup di almeno un account per sbloccare i tuoi contenuti.")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> {t("I tuoi contenuti")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Qui trovi tutto quello che devi realizzare. Leggi bene ogni brief prima di girare.")}
        </p>
      </div>

      {!content.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("Nessun contenuto assegnato al momento. Torna presto!")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {content.map((item) => {
            const badge = typeBadgeMap[item.type] ?? typeBadgeMap.brief;
            return (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={badge.variant}>{t(badge.label)}</Badge>
                      {item.status === "completato" && (
                        <Badge variant="outline" className="border-green-500/30 text-green-400">{t("Completato")}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.campaignName}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.body && (
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{item.body}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {item.file_url && (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <LinkIcon className="h-3 w-3" /> {t("Apri file")}
                      </a>
                    )}
                    {item.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {t("Consegna")}: {new Date(item.due_date).toLocaleDateString("it-IT")}
                      </span>
                    )}
                  </div>
                  {item.status !== "completato" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => {
                        updateStatus.mutate(
                          { contentId: item.id, status: "completato" },
                          { onSuccess: () => toast.success(t("Contenuto segnato come completato!")) }
                        );
                      }}
                    >
                      {t("Segna come completato")} ✓
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

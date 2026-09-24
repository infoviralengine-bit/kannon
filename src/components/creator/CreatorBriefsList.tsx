import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { CreatorBriefCard } from "./CreatorBriefCard";
import { useCreatorAssignedBriefs } from "@/hooks/useCreatorBriefs";

export function CreatorBriefsList() {
  const { t } = useI18n();
  const { data, isLoading } = useCreatorAssignedBriefs();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const briefs = data ?? [];
  if (briefs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {t("Nessun contenuto assegnato al momento.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {briefs.map((b) => (
        <CreatorBriefCard key={b.id} brief={b} />
      ))}
    </div>
  );
}

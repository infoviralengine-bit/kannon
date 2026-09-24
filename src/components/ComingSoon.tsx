import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
}

export function ComingSoon({ icon: Icon, title }: ComingSoonProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-2xl bg-card p-6">
          <Icon className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{t(title)}</h1>
        <p className="text-muted-foreground max-w-md">
          {t("Questa funzionalità sarà disponibile prossimamente.")}
        </p>
        <Badge variant="secondary" className="bg-primary/15 text-primary border-0 text-sm px-4 py-1">
          Coming Soon
        </Badge>
      </div>
    </div>
  );
}

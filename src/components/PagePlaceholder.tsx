import { LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";

interface PagePlaceholderProps {
  icon: LucideIcon;
  title: string;
}

export function PagePlaceholder({ icon: Icon, title }: PagePlaceholderProps) {
  const { t } = useI18n();
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">{t(title)}</h1>
      <div className="rounded-lg border border-border bg-card p-12 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Icon className="h-12 w-12 mx-auto mb-4 text-primary/40" />
          <p>{t("Il contenuto di questa sezione verrà costruito prossimamente.")}</p>
        </div>
      </div>
    </div>
  );
}

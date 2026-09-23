import { useI18n, type Lang } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const opts: Lang[] = ["it", "en"];
  return (
    <div
      role="group"
      aria-label={t("Lingua")}
      className={cn("flex items-center rounded-md border border-border p-0.5 text-xs", className)}
    >
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => setLang(o)}
          aria-pressed={lang === o}
          className={cn(
            "px-2 py-0.5 rounded font-medium uppercase transition-colors",
            lang === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

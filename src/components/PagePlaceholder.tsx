import { LucideIcon } from "lucide-react";

interface PagePlaceholderProps {
  icon: LucideIcon;
  title: string;
}

export function PagePlaceholder({ icon: Icon, title }: PagePlaceholderProps) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <div className="rounded-lg border border-border bg-card p-12 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Icon className="h-12 w-12 mx-auto mb-4 text-primary/40" />
          <p>Il contenuto di questa sezione verrà costruito prossimamente.</p>
        </div>
      </div>
    </div>
  );
}

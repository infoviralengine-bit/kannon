import { LucideIcon } from "lucide-react";

interface ComingSoonScaffoldProps {
  icon: LucideIcon;
  title: string;
  description: string;
  priority: string;
}

export function ComingSoonScaffold({ icon: Icon, title, description, priority }: ComingSoonScaffoldProps) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="flex flex-col items-center gap-5 text-center max-w-md px-6">
        <div className="rounded-full bg-primary/10 p-5 ring-1 ring-primary/20">
          <Icon className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-1.5 text-xs font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>In sviluppo — {priority}</span>
        </div>
      </div>
    </div>
  );
}
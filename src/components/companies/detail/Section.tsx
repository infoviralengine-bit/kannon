import type { ReactNode } from "react";

export function Section({ id, title, count, action, children }: {
  id: string; title: string; count?: number; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-border/50 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
          {title}
          {count !== undefined && <span className="ml-2 text-muted-foreground">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionNav({ items }: { items: { id: string; label: string; count?: number }[] }) {
  return (
    <nav className="sticky top-4 hidden space-y-0.5 lg:block">
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Indice</p>
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`}
          onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth" }); }}
          className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/10 hover:text-foreground">
          <span>{i.label}</span>
          {i.count !== undefined && <span className="text-xs text-muted-foreground">{i.count}</span>}
        </a>
      ))}
    </nav>
  );
}

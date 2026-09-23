import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDateIt, isOverdue } from "@/lib/companies";
import { useToggleOnboardingStep, type CompanyOnboardingStep } from "@/hooks/useCompanies";

export function OnboardingTab({ companyId, steps }: { companyId: string; steps: CompanyOnboardingStep[] }) {
  const toggle = useToggleOnboardingStep();
  const done = steps.filter((s) => s.is_done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  if (!steps.length) {
    return <p className="text-sm text-muted-foreground">La checklist parte quando la trattativa viene vinta.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Avanzamento</span>
          <span>{done} di {steps.length}</span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="space-y-2">
        {steps.map((s) => (
          <label key={s.id} className="flex items-start gap-3 rounded-md border border-border p-3">
            <Checkbox className="mt-0.5" checked={s.is_done}
              onCheckedChange={(v) => toggle.mutate({ id: s.id, isDone: !!v, companyId })} />
            <div className="flex-1">
              <p className={cn("text-sm", s.is_done && "text-muted-foreground line-through")}>{s.title}</p>
              {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
            </div>
            {s.due_date && (
              <span className={cn("text-xs",
                !s.is_done && isOverdue(s.due_date) ? "text-destructive" : "text-muted-foreground")}>
                {formatDateIt(s.due_date)}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

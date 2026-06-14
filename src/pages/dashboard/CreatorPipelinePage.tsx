import { GitMerge } from "lucide-react";
import { ComingSoonScaffold } from "@/components/ComingSoonScaffold";

export default function CreatorPipelinePage() {
  return (
    <ComingSoonScaffold
      icon={GitMerge}
      title="Creator Pipeline"
      description="Kanban drag&drop che unifica Closer + Onboarding in un'unica vista per gestire l'intero funnel creator."
      priority="In arrivo"
    />
  );
}
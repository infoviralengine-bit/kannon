import { Briefcase } from "lucide-react";
import { ComingSoonScaffold } from "@/components/ComingSoonScaffold";

export default function PipelineB2BPage() {
  return (
    <ComingSoonScaffold
      icon={Briefcase}
      title="Pipeline B2B"
      description="CRM kanban per tracciare brand prospect, deal in corso e revenue pipeline lato cliente."
      priority="In arrivo"
    />
  );
}
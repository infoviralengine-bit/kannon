import { useAuth } from "@/contexts/AuthContext";
import { OutreachMemberView } from "@/components/outreach/OutreachMemberView";
import { Navigate } from "react-router-dom";

export default function RecruitingPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "team";

  // Admin/team: redirect to the dedicated outreach management page
  if (isAdmin) {
    return <Navigate to="/dashboard/outreach" replace />;
  }

  // Outreach member view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Outreach</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestisci i tuoi account e registra le attività giornaliere</p>
      </div>
      <OutreachMemberView />
    </div>
  );
}

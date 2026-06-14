import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-lg bg-primary animate-pulse" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Role-based redirect
  if (role === ROLES.CREATOR && !window.location.pathname.startsWith("/creator")) {
    return <Navigate to="/creator" replace />;
  }
  if (role === ROLES.CLIENT && !window.location.pathname.startsWith("/client")) {
    return <Navigate to="/client" replace />;
  }
  if (
    role === ROLES.OUTREACH &&
    !window.location.pathname.startsWith("/dashboard/recruiting") &&
    !window.location.pathname.startsWith("/dashboard/hiring")
  ) {
    return <Navigate to="/dashboard/recruiting" replace />;
  }
  if (
    role === ROLES.CLOSER &&
    !window.location.pathname.startsWith("/dashboard/closer") &&
    !window.location.pathname.startsWith("/dashboard/creator-pipeline")
  ) {
    return <Navigate to="/dashboard/closer" replace />;
  }
  if (
    role === ROLES.CAMPAIGN_MANAGER &&
    !window.location.pathname.startsWith("/dashboard/content-calendar") &&
    !window.location.pathname.startsWith("/dashboard/campaign-manager") &&
    !window.location.pathname.startsWith("/dashboard/campaigns") &&
    !window.location.pathname.startsWith("/dashboard/videos")
  ) {
    return <Navigate to="/dashboard/content-calendar" replace />;
  }
  if ((role === ROLES.ADMIN || role === ROLES.TEAM) && (window.location.pathname === "/" || window.location.pathname === "/login")) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

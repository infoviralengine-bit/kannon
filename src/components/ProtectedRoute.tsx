import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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
  if (role === "creator" && !window.location.pathname.startsWith("/creator")) {
    return <Navigate to="/creator" replace />;
  }
  if (role === "client" && !window.location.pathname.startsWith("/client")) {
    return <Navigate to="/client" replace />;
  }
  if (role === "outreach" && !window.location.pathname.startsWith("/dashboard/recruiting")) {
    return <Navigate to="/dashboard/recruiting" replace />;
  }
  if (role === "closer" && !window.location.pathname.startsWith("/dashboard/closer")) {
    return <Navigate to="/dashboard/closer" replace />;
  }
  if ((role === "admin" || role === "team") && (window.location.pathname === "/" || window.location.pathname === "/login")) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

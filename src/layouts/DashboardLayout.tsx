import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LastUpdateBadge } from "@/components/topbar/LastUpdateBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { forceLang } from "@/i18n";

export function DashboardLayout() {
  useRealtimeInvalidation();
  const { role } = useAuth();
  const isOperator = role === "operator";
  // Operator UI is always Spanish, regardless of the saved language.
  useEffect(() => {
    forceLang(isOperator ? "es" : null);
    return () => forceLang(null);
  }, [isOperator]);
  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 shrink-0">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              {!isOperator && <LanguageSwitcher />}
              <LastUpdateBadge />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

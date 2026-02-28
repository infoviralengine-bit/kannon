import {
  Globe, Megaphone, Users, Smartphone, Wallet,
  BarChart3, Film, TrendingUp, Search, FileText,
  CalendarDays, Landmark, Settings, LogOut
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const mainItems = [
  { title: "Generale", url: "/dashboard", icon: Globe },
  { title: "Campagne", url: "/dashboard/campaigns", icon: Megaphone },
  { title: "Creator", url: "/dashboard/creators", icon: Users },
  { title: "Account", url: "/dashboard/accounts", icon: Smartphone },
  { title: "Payoff", url: "/dashboard/payoff", icon: Wallet },
];

const comingSoonItems = [
  { title: "Pipeline CRM", url: "/dashboard/pipeline", icon: BarChart3 },
  { title: "Media Library", url: "/dashboard/media", icon: Film },
  { title: "Report", url: "/dashboard/reports", icon: TrendingUp },
  { title: "Recruiting", url: "/dashboard/recruiting", icon: Search },
  { title: "Contratti", url: "/dashboard/contracts", icon: FileText },
  { title: "Calendario", url: "/dashboard/calendar", icon: CalendarDays },
  { title: "Finanza", url: "/dashboard/finance", icon: Landmark },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const allItems = role === "admin"
    ? [...comingSoonItems, { title: "Impostazioni", url: "/dashboard/settings", icon: Settings }]
    : comingSoonItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-sm text-primary-foreground shrink-0">
            K
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-foreground tracking-tight">Kannon</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principale</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/dashboard"}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Altro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={false}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3" />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{role}</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

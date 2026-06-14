import {
  Home, Megaphone, BarChart3, CalendarDays, GitMerge, Users, AtSign,
  FileText, UserPlus, Briefcase, Wallet, FileBarChart,
  Settings, LogOut, Search, PhoneCall,
  type LucideIcon,
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
import logoFull from "@/assets/kannon-logo-red.svg";
import logoSymbol from "@/assets/kannon-symbol-red.svg";
import { ROLES, ROLE_GROUPS, canAccess, type AppRole } from "@/lib/roles";

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  roles: readonly AppRole[];
  isNew?: boolean;
};

type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

const sidebarSections: SidebarSection[] = [
  {
    label: "Command Center",
    items: [
      { label: "Home", icon: Home, path: "/dashboard", roles: ROLE_GROUPS.STAFF },
      { label: "Recruiting", icon: Search, path: "/dashboard/recruiting", roles: [ROLES.OUTREACH] },
      { label: "Closer", icon: PhoneCall, path: "/dashboard/closer", roles: [ROLES.CLOSER] },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Campagne", icon: Megaphone, path: "/dashboard/campaigns", roles: [...ROLE_GROUPS.STAFF, ROLES.CAMPAIGN_MANAGER] },
      { label: "Video Analytics", icon: BarChart3, path: "/dashboard/videos", roles: [...ROLE_GROUPS.STAFF, ROLES.CAMPAIGN_MANAGER] },
      { label: "Calendario Contenuti", icon: CalendarDays, path: "/dashboard/content-calendar", roles: [...ROLE_GROUPS.STAFF, ROLES.CAMPAIGN_MANAGER] },
    ],
  },
  {
    label: "Creator",
    items: [
      { label: "Creator Pipeline", icon: GitMerge, path: "/dashboard/creator-pipeline", roles: [...ROLE_GROUPS.STAFF, ROLES.CLOSER], isNew: true },
      { label: "Creator", icon: Users, path: "/dashboard/creators", roles: ROLE_GROUPS.STAFF },
      { label: "Account", icon: AtSign, path: "/dashboard/accounts", roles: ROLE_GROUPS.STAFF },
      { label: "Contratti", icon: FileText, path: "/dashboard/contracts", roles: ROLE_GROUPS.STAFF },
      { label: "Hiring Creator", icon: UserPlus, path: "/dashboard/hiring", roles: [...ROLE_GROUPS.STAFF, ROLES.OUTREACH], isNew: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Pipeline B2B", icon: Briefcase, path: "/dashboard/pipeline-b2b", roles: ROLE_GROUPS.STAFF, isNew: true },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Finance", icon: Wallet, path: "/dashboard/finance", roles: [ROLES.ADMIN] },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Report", icon: FileBarChart, path: "/dashboard/reports", roles: ROLE_GROUPS.STAFF, isNew: true },
    ],
  },
];

const settingsItem: SidebarItem = {
  label: "Settings", icon: Settings, path: "/dashboard/settings", roles: [ROLES.ADMIN],
};

function NewBadge() {
  return (
    <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
      New
    </span>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, role, signOut } = useAuth();
  const appRole = (role as AppRole | null);

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

  const visibleSections = sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccess(appRole, item.roles)),
    }))
    .filter((section) => section.items.length > 0);

  const showSettings = canAccess(appRole, settingsItem.roles);

  const renderItem = (item: SidebarItem) => (
    <SidebarMenuItem key={item.path}>
      <SidebarMenuButton asChild isActive={isActive(item.path)}>
        <NavLink to={item.path} end={item.path === "/dashboard"} className="flex items-center gap-2">
          <item.icon className="h-4 w-4" />
          {!collapsed && <span>{item.label}</span>}
          {!collapsed && item.isNew && <NewBadge />}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-center">
          {collapsed ? (
            <img src={logoSymbol} alt="Kannon" className="h-7 w-7 shrink-0" />
          ) : (
            <img src={logoFull} alt="Kannon" className="h-8 w-auto" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {showSettings && (
          <>
            <div className="px-3 py-2">
              <Separator />
            </div>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>{renderItem(settingsItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
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

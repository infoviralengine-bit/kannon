import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Flame, Clock, FileWarning } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function iconFor(n: Notification) {
  switch (n.type) {
    case "viral_video":
      return <Flame className="h-3.5 w-3.5 text-orange-400" />;
    case "inactive_creator":
      return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
    case "expiring_contract":
      return <FileWarning className="h-3.5 w-3.5 text-yellow-400" />;
    case "cycle_to_close":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <Bell className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}g`;
}

export function NotificationBell() {
  const { role } = useAuth();
  const eligible = role === "admin" || role === "team" || role === "campaign_manager";
  const navigate = useNavigate();
  const { data, unreadCount, markAsRead, markAllAsRead } = useNotifications(eligible);

  if (!eligible) return null;

  const items = data ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notifiche"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-semibold leading-4 text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Notifiche</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => markAllAsRead.mutate()}
            >
              Segna lette
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nessuna notifica
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "px-3 py-2 text-xs flex gap-2 cursor-pointer hover:bg-muted/30 transition-colors",
                    !n.is_read && "bg-muted/20",
                  )}
                  onClick={() => {
                    if (!n.is_read) markAsRead.mutate(n.id);
                    if (n.link) navigate(n.link);
                  }}
                >
                  <span className="mt-0.5 shrink-0">{iconFor(n)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("truncate", !n.is_read && "font-medium")}>{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{relative(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
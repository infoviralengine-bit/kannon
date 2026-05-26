import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribes to Supabase Realtime on key tables and invalidates React Query caches.
 * Throttled to avoid invalidation storms during bulk scraping.
 */
export function useRealtimeInvalidation() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const lastInvalidatedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const eligible = role === "admin" || role === "team" || role === "campaign_manager";

    const throttle = (key: string, fn: () => void, ms = 5000) => {
      const now = Date.now();
      const last = lastInvalidatedRef.current[key] ?? 0;
      if (now - last < ms) return;
      lastInvalidatedRef.current[key] = now;
      fn();
    };

    const channels = [] as ReturnType<typeof supabase.channel>[];

    if (eligible) {
      const vidCh = supabase
        .channel("rt-videos")
        .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, () => {
          throttle("videos", () => {
            qc.invalidateQueries({ queryKey: ["campaign-manager"] });
            qc.invalidateQueries({ queryKey: ["videos"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
          });
        })
        .subscribe();
      channels.push(vidCh);

      const logCh = supabase
        .channel("rt-scraping-logs")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "scraping_logs" }, () => {
          throttle("scraping_logs", () => {
            qc.invalidateQueries({ queryKey: ["scraping-logs"] });
            qc.invalidateQueries({ queryKey: ["last-scrape-at"] });
          }, 2000);
        })
        .subscribe();
      channels.push(logCh);
    }

    const notifCh = supabase
      .channel(`rt-notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    channels.push(notifCh);

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [user, role, qc]);
}
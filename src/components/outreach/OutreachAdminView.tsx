import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, TrendingUp, Trophy } from "lucide-react";
import { useAllOutreachMembers, useOutreachTemplates } from "@/hooks/useOutreachData";
import { Skeleton } from "@/components/ui/skeleton";

interface MemberStats {
  profileId: string;
  name: string;
  totalDm: number;
  totalReplies: number;
  responseRate: number;
  accountCount: number;
}

export function OutreachAdminView() {
  const { data, isLoading } = useAllOutreachMembers();
  const { data: templates = [] } = useOutreachTemplates(true);

  const memberStats = useMemo<MemberStats[]>(() => {
    if (!data) return [];
    const { accounts, profiles, stats } = data;

    // Group by owner_profile_id
    const map = new Map<string, MemberStats>();
    for (const acc of accounts) {
      const pid = acc.owner_profile_id;
      if (!pid) continue;
      if (!map.has(pid)) {
        const profile = profiles.find(p => p.id === pid);
        map.set(pid, {
          profileId: pid,
          name: profile?.full_name ?? "Sconosciuto",
          totalDm: 0,
          totalReplies: 0,
          responseRate: 0,
          accountCount: 0,
        });
      }
      const m = map.get(pid)!;
      m.accountCount++;
      // Sum stats for this account
      for (const s of stats) {
        if (s.tiktok_account_id === acc.id) {
          m.totalDm += s.dm_sent ?? 0;
          m.totalReplies += s.replies_received ?? 0;
        }
      }
    }

    const arr = Array.from(map.values());
    for (const m of arr) {
      m.responseRate = m.totalDm > 0 ? (m.totalReplies / m.totalDm) * 100 : 0;
    }
    return arr.sort((a, b) => b.totalDm - a.totalDm);
  }, [data]);

  // Template performance
  const templateStats = useMemo(() => {
    if (!data) return [];
    const { stats } = data;
    const map = new Map<string, { name: string; dm: number; replies: number }>();
    for (const s of stats) {
      const tid = s.template_id ?? "none";
      const tpl = templates.find(t => t.id === tid);
      const name = tpl?.name ?? "Senza template";
      if (!map.has(tid)) map.set(tid, { name, dm: 0, replies: 0 });
      const m = map.get(tid)!;
      m.dm += s.dm_sent ?? 0;
      m.replies += s.replies_received ?? 0;
    }
    return Array.from(map.values())
      .map(t => ({ ...t, rate: t.dm > 0 ? (t.replies / t.dm) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [data, templates]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const totalDm = memberStats.reduce((s, m) => s + m.totalDm, 0);
  const totalReplies = memberStats.reduce((s, m) => s + m.totalReplies, 0);
  const overallRate = totalDm > 0 ? ((totalReplies / totalDm) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Overall KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalDm.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">DM totali</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalReplies.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Risposte totali</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{overallRate}%</p>
                <p className="text-xs text-muted-foreground">Tasso di risposta</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{memberStats.length}</p>
                <p className="text-xs text-muted-foreground">Membri del team</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Classifica Team</CardTitle>
        </CardHeader>
        <CardContent>
          {memberStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun membro con attività registrate.</p>
          ) : (
            <div className="space-y-3">
              {memberStats.map((m, i) => (
                <div key={m.profileId} className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.accountCount} account</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{m.totalDm.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">DM</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{m.totalReplies.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Risposte</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{m.responseRate.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Tasso</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance Template</CardTitle>
        </CardHeader>
        <CardContent>
          {templateStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
          ) : (
            <div className="space-y-2">
              {templateStats.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs">{t.name}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-foreground">{t.dm.toLocaleString()} DM</span>
                    <span className="text-foreground">{t.replies.toLocaleString()} risposte</span>
                    <span className="text-primary font-medium">{t.rate.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

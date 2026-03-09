import { useAuth } from "@/contexts/AuthContext";
import { useCreatorAreaData } from "@/hooks/usePortalData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Video, Eye, Calendar } from "lucide-react";
import { formatCurrency, formatViews } from "@/lib/format";

export default function CreatorArea() {
  const { profile, signOut } = useAuth();
  const { data, isLoading } = useCreatorAreaData();

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">K</div>
            <span className="font-semibold text-lg">Kannon</span>
          </div>
          <Skeleton className="h-8 w-24" />
        </header>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-5">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">K</div>
            <span className="font-semibold text-lg">Kannon</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Esci</Button>
        </header>
        <div className="max-w-2xl mx-auto p-6 text-center mt-20">
          <h2 className="text-xl font-semibold mb-2">Nessun profilo creator collegato</h2>
          <p className="text-muted-foreground">Contatta l'agenzia per collegare il tuo account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">K</div>
          <span className="font-semibold text-lg">Kannon</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Esci</Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-8 animate-fade-in">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">Ciao, {data.creator.name}!</h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Video oggi</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{data.todayVideos}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Video settimana</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{data.weekVideos}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Video mese</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{data.monthVideos}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Views totali</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{formatViews(data.totalViews)}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Views mese</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{formatViews(data.monthViews)}</span></CardContent>
          </Card>
        </div>

        {/* Payoff per contratto */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Payoff mese corrente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!data.contractBreakdowns.length ? (
              <p className="text-sm text-muted-foreground">Nessun contratto attivo</p>
            ) : (
              data.contractBreakdowns.map((b) => (
                <div key={b.contractId} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
                  <h3 className="font-medium text-sm text-primary">{b.contractName}</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fisso {b.fixedEarned ? "✅" : "❌"}</span>
                    <span className="font-medium">{formatCurrency(b.fixedEarned ? b.fixedAmount : 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">CPM ({formatCurrency(b.cpmRate)}/1k)</span>
                    <span className="font-medium">{formatCurrency(b.cpmAmount)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Video: {b.videoCount}/{b.monthlyTarget} · Views: {formatViews(b.totalViews)}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Subtotale</span>
                    <span className="font-semibold">{formatCurrency(b.subtotal)}</span>
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold">Totale stimato</span>
              <span className="text-xl font-bold">{formatCurrency(data.totalPayoff)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Il payoff finale viene calcolato a fine mese</p>
          </CardContent>
        </Card>

        {/* Accounts */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">I miei account</h2>
          {!data.accountRows.length ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun account collegato</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Campagna</TableHead>
                    <TableHead className="text-right">Video oggi</TableHead>
                    <TableHead className="text-right">Views totali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accountRows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">@{a.username}</TableCell>
                      <TableCell>{a.campaignName}</TableCell>
                      <TableCell className="text-right">{a.todayVideos}</TableCell>
                      <TableCell className="text-right">{formatViews(a.totalViews)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {/* Recent Videos */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">I miei video (ultimi 30)</h2>
          {!data.recentVideos.length ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun video pubblicato</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Video ID</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Commenti</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentVideos.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>@{v.accountUsername}</TableCell>
                      <TableCell>
                        <a
                          href={`https://www.tiktok.com/@/video/${v.tiktok_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {v.tiktok_video_id.slice(0, 12)}…
                        </a>
                      </TableCell>
                      <TableCell>{new Date(v.published_at).toLocaleDateString("it-IT")}</TableCell>
                      <TableCell className="text-right">{formatViews(v.views ?? 0)}</TableCell>
                      <TableCell className="text-right">{formatViews(v.likes ?? 0)}</TableCell>
                      <TableCell className="text-right">{formatViews(v.comments ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClientAreaData } from "@/hooks/usePortalData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Eye, Heart, MessageCircle, Users, Video, CalendarDays, TrendingUp, AtSign } from "lucide-react";
import { formatViews } from "@/lib/format";

type Period = "1d" | "7d" | "30d" | "90d";

const periodLabels: Record<Period, string> = {
  "1d": "Oggi",
  "7d": "7 giorni",
  "30d": "30 giorni",
  "90d": "90 giorni",
};

function ClientHeader() {
  const { profile, signOut } = useAuth();
  return (
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
  );
}

export default function ClientArea() {
  const { data, isLoading } = useClientAreaData();
  const [period, setPeriod] = useState<Period>("30d");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ClientHeader />
        <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ClientHeader />
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <h2 className="text-xl font-semibold mb-2">Nessuna campagna collegata</h2>
            <p className="text-muted-foreground">Contatta l'agenzia per collegare la tua campagna.</p>
          </div>
        </div>
      </div>
    );
  }

  const views = data[`views_${period}`];
  const likes = data[`likes_${period}`];
  const comments = data[`comments_${period}`];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ClientHeader />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-8 animate-fade-in">
        {/* Campaign title & status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{data.campaign.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{data.campaign.client_name}</p>
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${data.campaign.status === "active" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
            {data.campaign.status === "active" ? "Attiva" : data.campaign.status}
          </span>
        </div>

        {/* Period selector */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <TabsTrigger key={p} value={p}>{periodLabels[p]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Performance metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <Eye className="h-7 w-7 text-primary" />
              <p className="text-3xl font-bold">{formatViews(views)}</p>
              <p className="text-sm text-muted-foreground">Visualizzazioni</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <Heart className="h-7 w-7 text-rose-500" />
              <p className="text-3xl font-bold">{formatViews(likes)}</p>
              <p className="text-sm text-muted-foreground">Like</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <MessageCircle className="h-7 w-7 text-sky-500" />
              <p className="text-3xl font-bold">{formatViews(comments)}</p>
              <p className="text-sm text-muted-foreground">Commenti</p>
            </CardContent>
          </Card>
        </div>

        {/* Operational stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <Users className="h-7 w-7 text-primary" />
              <p className="text-3xl font-bold">{data.active_creators}</p>
              <p className="text-sm text-muted-foreground">Account Attivi</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <Video className="h-7 w-7 text-primary" />
              <p className="text-3xl font-bold">{data.videos_today}</p>
              <p className="text-sm text-muted-foreground">Video Oggi</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <TrendingUp className="h-7 w-7 text-primary" />
              <p className="text-3xl font-bold">{data.avg_videos_per_day_30d}</p>
              <p className="text-sm text-muted-foreground">Media Video/Giorno (30gg)</p>
            </CardContent>
          </Card>
        </div>

        {/* Account list */}
        {data.accounts && data.accounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AtSign className="h-5 w-5" /> Account TikTok
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Views Totali</TableHead>
                    <TableHead className="text-right">Views 30gg</TableHead>
                    <TableHead className="text-right">Video Totali</TableHead>
                    <TableHead className="text-right">Video Oggi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accounts.map((acc) => (
                    <TableRow key={acc.username}>
                      <TableCell className="font-medium">@{acc.username}</TableCell>
                      <TableCell className="text-right">{formatViews(acc.total_views)}</TableCell>
                      <TableCell className="text-right">{formatViews(acc.views_30d)}</TableCell>
                      <TableCell className="text-right">{acc.total_videos}</TableCell>
                      <TableCell className="text-right">{acc.videos_today}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Campaign details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> Dettagli Campagna
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Inizio</p>
                <p className="font-medium">{new Date(data.campaign.start_date).toLocaleDateString("it-IT")}</p>
              </div>
              {data.campaign.end_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Fine</p>
                  <p className="font-medium">{new Date(data.campaign.end_date).toLocaleDateString("it-IT")}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Account Attivi / Totali</p>
                <p className="font-medium">{data.active_creators} / {data.total_creators}</p>
              </div>
              {data.campaign.video_views_cap != null && (
                <div>
                  <p className="text-sm text-muted-foreground">Cap Views / Video</p>
                  <p className="font-medium">{formatViews(data.campaign.video_views_cap)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Video Totali</p>
                <p className="font-medium">{formatViews(data.total_videos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">Dati aggiornati ogni 2 ore</p>
      </div>

      <footer className="border-t border-border py-4 text-center">
        <p className="text-xs text-muted-foreground">Powered by Kannon</p>
      </footer>
    </div>
  );
}

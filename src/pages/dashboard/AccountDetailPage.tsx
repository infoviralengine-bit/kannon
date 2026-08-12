import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccountDetail } from "@/hooks/useAccountData";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatViews, formatCurrency } from "@/lib/format";
import { cleanUsername } from "@/lib/utils";
import { TikTokLink } from "@/components/TikTokLink";
import { format } from "date-fns";
import { getWindowStatus, getWindowDaysRemaining } from "@/lib/videoWindow";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plus, ExternalLink } from "lucide-react";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useAccountDetail(id!);

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!data.account) {
    return <div className="text-center py-12 text-muted-foreground">Account non trovato.</div>;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/dashboard/accounts">Account</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>@{cleanUsername(data.account.username)}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><TikTokLink username={data.account.username} className="text-2xl" /></h1>
        <Badge variant="default">Creator</Badge>
      </div>

      {data.creator && (
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>Creator: <Link to={`/dashboard/creators/${data.creator.id}`} className="text-primary hover:underline">{data.creator.name}</Link></span>
          {data.campaign && (
            <span>Campagna: <Link to={`/dashboard/campaigns/${data.campaign.id}`} className="text-primary hover:underline">{data.campaign.name}</Link></span>
          )}
        </div>
      )}

      <CreatorDetail data={data} />
    </div>
  );
}

function KPICard({ title, value, icon }: { title: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function CreatorDetail({ data }: { data: ReturnType<typeof useAccountDetail> }) {
  const queryClient = useQueryClient();
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoId, setVideoId] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [views, setViews] = useState("0");
  const [likes, setLikes] = useState("0");
  const [comments, setComments] = useState("0");

  const min = 0; // Video target mechanism removed
  const ok = true;

  // Fetch campaign's video_views_cap
  const campaignId = data.account?.campaign_id;
  const { data: campData } = useQuery({
    queryKey: ["campaign-cap", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data: c } = await supabase.from("campaigns").select("video_views_cap").eq("id", campaignId).single();
      return c;
    },
    enabled: !!campaignId,
  });
  const videoCap = (campData as any)?.video_views_cap as number | null;

  const addVideoMutation = useMutation({
    mutationFn: async () => {
      const publishedAt = new Date(pubDate);
      const windowExpiresAt = new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from("videos").insert({
        tiktok_account_id: data.account!.id,
        tiktok_video_id: videoId,
        published_at: pubDate,
        views: parseInt(views) || 0,
        likes: parseInt(likes) || 0,
        comments: parseInt(comments) || 0,
        window_expires_at: windowExpiresAt.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos_for_account"] });
      toast({ title: "Video aggiunto" });
      setVideoOpen(false);
      setVideoId(""); setPubDate(""); setViews("0"); setLikes("0"); setComments("0");
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const chartConfig = {
    views: { label: "Views", color: "hsl(var(--primary))" },
  };

  function renderCapCell(videoViews: number) {
    if (videoCap == null) return "—";
    if (videoViews >= videoCap) {
      return <span className="text-warning font-semibold">⚠️ CAP RAGGIUNTO</span>;
    }
    const vk = videoViews >= 1000 ? `${(videoViews / 1000).toFixed(0)}k` : String(videoViews);
    const ck = videoCap >= 1000 ? `${(videoCap / 1000).toFixed(0)}k` : String(videoCap);
    return <span className="text-success">{vk} / {ck}</span>;
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Video oggi"
          value={data.videosToday}
        />
        <KPICard title="Video settimana" value={data.videosWeek} />
        <KPICard title="Video mese" value={data.videosMonth} />
        <KPICard title="Views oggi" value={formatViews(data.viewsToday)} />
        <KPICard title="Views settimana" value={formatViews(data.viewsWeek)} />
        <KPICard title="Views mese" value={formatViews(data.viewsMonth)} />
      </div>


      {/* Chart */}
      <Card>
        <CardHeader><CardTitle>Views ultimi 30 giorni</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={data.last30Days}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Videos table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Video</CardTitle>
          <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Aggiungi Video</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Aggiungi Video manualmente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>TikTok Video ID</Label><Input value={videoId} onChange={(e) => setVideoId(e.target.value)} /></div>
                <div><Label>Data pubblicazione</Label><Input type="datetime-local" value={pubDate} onChange={(e) => setPubDate(e.target.value)} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Views</Label><Input type="number" value={views} onChange={(e) => setViews(e.target.value)} /></div>
                  <div><Label>Likes</Label><Input type="number" value={likes} onChange={(e) => setLikes(e.target.value)} /></div>
                  <div><Label>Commenti</Label><Input type="number" value={comments} onChange={(e) => setComments(e.target.value)} /></div>
                </div>
                <Button className="w-full" disabled={!videoId || !pubDate} onClick={() => addVideoMutation.mutate()}>Salva Video</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {data.videos.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nessun video registrato.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video ID</TableHead>
                  <TableHead>Data pubblicazione</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Commenti</TableHead>
                  <TableHead>Cap</TableHead>
                  <TableHead>Finestra</TableHead>
                  <TableHead>Ultimo scraping</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.videos.map((v) => {
                  const wStatus = getWindowStatus(v as any);
                  const daysLeft = getWindowDaysRemaining(v as any);
                  return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <a
                        href={`https://www.tiktok.com/@${cleanUsername(data.account?.username)}/video/${v.tiktok_video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {v.tiktok_video_id.slice(0, 12)}… <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>{format(new Date(v.published_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="text-right">{formatViews(v.views || 0)}</TableCell>
                    <TableCell className="text-right">{formatViews(v.likes || 0)}</TableCell>
                    <TableCell className="text-right">{formatViews(v.comments || 0)}</TableCell>
                    <TableCell>{renderCapCell(v.views || 0)}</TableCell>
                    <TableCell>
                      {wStatus === "open" && (
                        <span className="text-sm">🟢 {daysLeft}g rimasti</span>
                      )}
                      {wStatus === "closing" && (
                        <span className="text-sm text-warning">⏳ &lt;24h</span>
                      )}
                      {wStatus === "closed" && (
                        <span className="text-sm text-muted-foreground">🔴 Chiusa{v.window_expires_at ? ` ${format(new Date(v.window_expires_at), "dd/MM")}` : ""}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {v.last_scraped_at ? format(new Date(v.last_scraped_at), "dd/MM HH:mm") : "—"}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

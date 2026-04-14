import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Video, Eye, Heart, MessageCircle, Clock, CheckCircle, ExternalLink } from "lucide-react";
import { formatViews } from "@/lib/format";

export interface CreatorVideo {
  id: string;
  tiktokVideoId: string;
  accountUsername: string;
  accountId: string;
  campaignName: string;
  campaignId: string | null;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  windowClosed: boolean;
  viewsFinal: number | null;
}

interface Props {
  videos: CreatorVideo[];
  monthLabel?: string;
}

export default function CreatorVideoList({ videos, monthLabel }: Props) {
  // Group by campaign, then by account
  const campaignGroups = new Map<string, { name: string; accounts: Map<string, { username: string; videos: CreatorVideo[] }> }>();

  videos.forEach((v) => {
    const campKey = v.campaignId ?? "no-campaign";
    if (!campaignGroups.has(campKey)) {
      campaignGroups.set(campKey, { name: v.campaignName, accounts: new Map() });
    }
    const group = campaignGroups.get(campKey)!;
    if (!group.accounts.has(v.accountId)) {
      group.accounts.set(v.accountId, { username: v.accountUsername, videos: [] });
    }
    group.accounts.get(v.accountId)!.videos.push(v);
  });

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Nessun video pubblicato in questo periodo</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          Video pubblicati {monthLabel && `— ${monthLabel}`}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {videos.length} video totali in questo periodo
        </p>
      </div>

      {Array.from(campaignGroups.entries()).map(([campKey, { name: campName, accounts }]) => (
        <Card key={campKey}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Badge variant="outline" className="font-normal">{campName}</Badge>
              <span className="text-muted-foreground text-xs">
                {Array.from(accounts.values()).reduce((s, a) => s + a.videos.length, 0)} video
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(accounts.entries()).map(([accId, { username, videos: accVideos }]) => (
              <div key={accId}>
                <div className="flex items-center gap-2 mb-2">
                  <a
                    href={`https://www.tiktok.com/@${cleanUsername(username)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    @{cleanUsername(username)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-xs text-muted-foreground">
                    ({accVideos.length} video)
                  </span>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Pubblicato</TableHead>
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1"><Eye className="h-3.5 w-3.5" /> Views</span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1"><Heart className="h-3.5 w-3.5" /> Likes</span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1"><MessageCircle className="h-3.5 w-3.5" /> Commenti</span>
                        </TableHead>
                        <TableHead className="text-center">Finestra CPM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accVideos.map((v) => {
                        const date = new Date(v.publishedAt);
                        const dateStr = date.toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                        const timeStr = date.toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <TableRow key={v.id}>
                            <TableCell>
                              <div>
                                <span className="text-sm">{dateStr}</span>
                                <span className="text-xs text-muted-foreground ml-2">{timeStr}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatViews(v.viewsFinal ?? v.views)}
                            </TableCell>
                            <TableCell className="text-right">{formatViews(v.likes)}</TableCell>
                            <TableCell className="text-right">{formatViews(v.comments)}</TableCell>
                            <TableCell className="text-center">
                              {v.windowClosed ? (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <CheckCircle className="h-3 w-3" /> Chiusa
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Clock className="h-3 w-3" /> Aperta
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

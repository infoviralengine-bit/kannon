import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/format";
import { cleanUsername } from "@/lib/utils";
import { useVideoFormats } from "@/hooks/useContentCatalog";
import { arr, num } from "./_shared";

const PAGE = 100;

export function VideoListWithTagging({ data }: { data: any }) {
  const qc = useQueryClient();
  const { data: formats } = useVideoFormats();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const videos = arr<any>(data?.allVideos);

  const saveTag = useMutation({
    mutationFn: async ({ videoId, tag }: { videoId: string; tag: string | null }) => {
      const { error } = await supabase.from("videos").update({ content_tag: tag }).eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-analytics"] });
      toast({ title: "Formato salvato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) =>
      `${v.username ?? ""} ${v.creatorName ?? ""} ${v.campaignName ?? ""}`.toLowerCase().includes(q)
    );
  }, [videos, search]);

  const shown = filtered.slice(0, limit);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Video pubblicati</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Cerca per account, creator o campagna" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Campagna</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">ER</TableHead>
                <TableHead>Format</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((v) => (
                <TableRow key={v.videoId}>
                  <TableCell>
                    <a href={`https://www.tiktok.com/@${cleanUsername(v.username)}/video/${v.tiktokVideoId}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                      @{cleanUsername(v.username)} <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell>{v.creatorName}</TableCell>
                  <TableCell>{v.campaignName}</TableCell>
                  <TableCell className="text-right">{formatViews(num(v.views))}</TableCell>
                  <TableCell className="text-right">{num(v.engagementRate).toFixed(1)}%</TableCell>
                  <TableCell>
                    <Select
                      value={v.contentTag ?? "__none__"}
                      onValueChange={(val) => saveTag.mutate({ videoId: v.videoId, tag: val === "__none__" ? null : val })}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs border-dashed"><SelectValue placeholder="Format..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__"><span className="text-muted-foreground">Nessuno</span></SelectItem>
                        {(formats ?? []).map((f) => (
                          <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length > limit && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Mostra altri</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

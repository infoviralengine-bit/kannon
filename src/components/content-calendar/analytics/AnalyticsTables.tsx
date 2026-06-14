import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatViews } from "@/lib/format";
import { cleanUsername } from "@/lib/utils";
import { arr, num } from "./_shared";

export function CampaignsTable({ data }: { data: any }) {
  const rows = arr<any>(data?.campaigns);
  if (rows.length === 0) return null;
  return (
    <Section title="Campagne">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Campagna</TableHead><TableHead className="text-right">Views</TableHead><TableHead className="text-center">Creator</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.sort((a, b) => num(b.views) - num(a.views)).map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-right">{formatViews(num(c.views))}</TableCell>
              <TableCell className="text-center">{num(c.activeCreators)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

export function CreatorRankingTable({ data }: { data: any }) {
  const rows = arr<any>(data?.creatorRankingDetailed);
  if (rows.length === 0) return null;
  return (
    <Section title="Ranking creator">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Creator</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-center">Video</TableHead>
            <TableHead className="text-right">ER</TableHead>
            <TableHead className="text-right">Quality</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c, i) => (
            <TableRow key={c.creatorId ?? i}>
              <TableCell className="font-medium">{c.creatorName ?? "Sconosciuto"}</TableCell>
              <TableCell className="text-right">{formatViews(num(c.views))}</TableCell>
              <TableCell className="text-center">{num(c.videoCount)}</TableCell>
              <TableCell className="text-right">{num(c.engagementRate).toFixed(1)}%</TableCell>
              <TableCell className="text-right">{num(c.qualityScore).toFixed(0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

export function FormatStatsTable({ data }: { data: any }) {
  const breakdown = arr<any>(data?.format_breakdown);
  if (breakdown.length > 0) {
    return (
      <Section title="Performance per format">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Format</TableHead>
              <TableHead className="text-center">Brief</TableHead>
              <TableHead className="text-center">Video</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Eng. %</TableHead>
              <TableHead className="text-center">Winner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.map((f) => (
              <TableRow key={f.format_id}>
                <TableCell className="font-medium">{f.format_name}</TableCell>
                <TableCell className="text-center">{num(f.brief_count)}</TableCell>
                <TableCell className="text-center">{num(f.video_count)}</TableCell>
                <TableCell className="text-right">{formatViews(num(f.total_views))}</TableCell>
                <TableCell className="text-right">{num(f.avg_engagement_pct).toFixed(1)}%</TableCell>
                <TableCell className="text-center">{num(f.winner_count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    );
  }
  // Legacy fallback
  const legacy = arr<any>(data?.formatStats);
  if (legacy.length === 0) return null;
  return (
    <Section title="Performance per format">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Tag</TableHead><TableHead className="text-center">Video</TableHead><TableHead className="text-right">Media views</TableHead><TableHead className="text-right">Eng. %</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {legacy.map((f, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{f.tag}</TableCell>
              <TableCell className="text-center">{num(f.videoCount)}</TableCell>
              <TableCell className="text-right">{formatViews(num(f.avgViews))}</TableCell>
              <TableCell className="text-right">{num(f.avgEngagement).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

export function TopicStatsTable({ data }: { data: any }) {
  const rows = arr<any>(data?.topic_breakdown);
  if (rows.length === 0) return null;
  return (
    <Section title="Performance per topic">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead className="text-center">Brief</TableHead>
            <TableHead className="text-center">Video</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Eng. %</TableHead>
            <TableHead className="text-center">Winner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.topic_id}>
              <TableCell className="font-medium">{t.topic_name}</TableCell>
              <TableCell className="text-center">{num(t.brief_count)}</TableCell>
              <TableCell className="text-center">{num(t.video_count)}</TableCell>
              <TableCell className="text-right">{formatViews(num(t.total_views))}</TableCell>
              <TableCell className="text-right">{num(t.avg_engagement_pct).toFixed(1)}%</TableCell>
              <TableCell className="text-center">{num(t.winner_count)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

export function ViralVideosTable({ data }: { data: any }) {
  const rows = arr<any>(data?.viralVideos);
  if (rows.length === 0) return null;
  return (
    <Section title="Top performer">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Account</TableHead><TableHead>Creator</TableHead><TableHead className="text-right">Views</TableHead><TableHead className="text-right">ER</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((v) => (
            <TableRow key={v.videoId}>
              <TableCell>
                <a href={`https://www.tiktok.com/@${cleanUsername(v.username)}/video/${v.tiktokVideoId}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                  @{cleanUsername(v.username)} <ExternalLink className="h-3 w-3" />
                </a>
              </TableCell>
              <TableCell>{v.creatorName}</TableCell>
              <TableCell className="text-right">{formatViews(num(v.views))}</TableCell>
              <TableCell className="text-right">{num(v.engagementRate).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useTopVideos, type TopVideosSortBy, type VideoAnalyticsFilters } from "@/hooks/useVideoAnalytics";
import { formatViews } from "@/lib/format";

const PAGE_SIZE = 25;

const WINDOW_LABEL: Record<string, string> = { open: "Aperta", closing: "In chiusura", closed: "Chiusa" };
const WINDOW_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  open: "default",
  closing: "secondary",
  closed: "outline",
};

export function TopVideosTable({ filters }: { filters: VideoAnalyticsFilters }) {
  const [sortBy, setSortBy] = useState<TopVideosSortBy>("views");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useTopVideos(filters, sortBy, sortDir, page, PAGE_SIZE);

  const toggleSort = (k: TopVideosSortBy) => {
    if (sortBy === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else {
      setSortBy(k);
      setSortDir("desc");
    }
    setPage(0);
  };

  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const sortBtn = (label: string, key: TopVideosSortBy) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Top video</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalCount.toLocaleString("it-IT")} video totali
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account / Creator / Campagna</TableHead>
              <TableHead>{sortBtn("Pubblicato", "published")}</TableHead>
              <TableHead className="text-right">{sortBtn("Views", "views")}</TableHead>
              <TableHead className="text-right">{sortBtn("Like", "likes")}</TableHead>
              <TableHead className="text-right">{sortBtn("Commenti", "comments")}</TableHead>
              <TableHead className="text-right">{sortBtn("ER%", "engagement")}</TableHead>
              <TableHead>Finestra</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.rows.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nessun video nel periodo selezionato
                </TableCell>
              </TableRow>
            )}
            {data?.rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="font-medium">@{v.account_username}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.creator_name ?? "—"} · {v.campaign_name ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(v.published_at).toLocaleDateString("it-IT")}
                </TableCell>
                <TableCell className="text-right font-medium">{formatViews(Number(v.effective_views))}</TableCell>
                <TableCell className="text-right">{formatViews(Number(v.likes))}</TableCell>
                <TableCell className="text-right">{formatViews(Number(v.comments))}</TableCell>
                <TableCell className="text-right">{Number(v.engagement_pct).toFixed(2)}%</TableCell>
                <TableCell>
                  <Badge variant={WINDOW_VARIANT[v.window_status] ?? "outline"}>
                    {WINDOW_LABEL[v.window_status] ?? v.window_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={v.tiktok_url} target="_blank" rel="noopener" aria-label="Apri su TikTok">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Pagina {page + 1} di {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
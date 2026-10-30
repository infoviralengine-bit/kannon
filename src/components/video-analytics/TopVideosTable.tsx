import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  useTopVideos, fetchAllTopVideos, type TopVideosSortBy, type VideoAnalyticsFilters,
} from "@/hooks/useVideoAnalytics";
import {
  topVideoExportColumns, buildTopVideosCsv, buildTopVideosXlsx, downloadBlob,
} from "@/lib/videoExport";
import { formatViews } from "@/lib/format";
import { useI18n } from "@/i18n";

const PAGE_SIZE = 25;


export function TopVideosTable({ filters }: { filters: VideoAnalyticsFilters }) {
  const { t } = useI18n();
  const [sortBy, setSortBy] = useState<TopVideosSortBy>("views");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useTopVideos(filters, sortBy, sortDir, page, PAGE_SIZE);

  const toggleSort = (k: TopVideosSortBy) => {
    if (sortBy === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else {
      setSortBy(k);
      setSortDir("desc");
    }
    setPage(0);
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      const rows = await fetchAllTopVideos(filters, sortBy, sortDir);
      const columns = topVideoExportColumns(t);
      const name = `top-video_${filters.from}_${filters.to}.${format}`;
      const blob =
        format === "csv"
          ? new Blob([buildTopVideosCsv(rows, columns)], { type: "text/csv;charset=utf-8" })
          : await buildTopVideosXlsx(rows, columns);
      downloadBlob(blob, name);
      toast({ title: t("{n} video esportati", { n: rows.length.toLocaleString("it-IT") }) });
    } catch (e: any) {
      toast({ title: t("Errore esportazione"), description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
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
        <CardTitle>{t("Top video")}</CardTitle>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {t("{n} video totali", { n: totalCount.toLocaleString("it-IT") })}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={exporting || totalCount === 0}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t("Esporta")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Account / Creator / Campagna")}</TableHead>
              <TableHead>{t("Caption")}</TableHead>
              <TableHead>{sortBtn(t("Pubblicato"), "published")}</TableHead>
              <TableHead className="text-right">{sortBtn("Views", "views")}</TableHead>
              <TableHead className="text-right">{sortBtn(t("Like"), "likes")}</TableHead>
              <TableHead className="text-right">{sortBtn(t("Commenti"), "comments")}</TableHead>
              <TableHead className="text-right">{sortBtn(t("Condivisioni"), "shares")}</TableHead>
              <TableHead className="text-right">{sortBtn(t("Salvataggi"), "saves")}</TableHead>
              <TableHead className="text-right">{sortBtn("ER%", "engagement")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {t("Caricamento...")}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.rows.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {t("Nessun video nel periodo selezionato")}
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
                <TableCell className="max-w-[280px]">
                  <p className="text-sm line-clamp-2" title={v.caption ?? ""}>{v.caption || "—"}</p>
                  {(v.hashtags?.length || v.audio_name) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {(v.hashtags ?? []).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                      {v.hashtags?.length && v.audio_name ? " · " : ""}
                      {v.audio_name ? `♪ ${v.audio_name}` : ""}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(v.published_at).toLocaleDateString("it-IT")}
                </TableCell>
                <TableCell className="text-right font-medium">{formatViews(Number(v.effective_views))}</TableCell>
                <TableCell className="text-right">{formatViews(Number(v.likes))}</TableCell>
                <TableCell className="text-right">{formatViews(Number(v.comments))}</TableCell>
                <TableCell className="text-right">{formatViews(Number(v.shares ?? 0))}</TableCell>
                <TableCell className="text-right">{formatViews(Number(v.saves ?? 0))}</TableCell>
                <TableCell className="text-right">{Number(v.engagement_pct).toFixed(2)}%</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={v.tiktok_url} target="_blank" rel="noopener" aria-label={t("Apri su TikTok")}>
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
            {t("Pagina {page} di {total}", { page: page + 1, total: totalPages })}
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
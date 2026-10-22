import { useEffect, useState } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatViews } from "@/lib/format";
import { useI18n } from "@/i18n";
import { useOperatorVideoList, type OperatorFilters, type OperatorSort } from "@/hooks/useOperatorData";

const PAGE_SIZE = 25;
const WINDOW_LABEL: Record<string, string> = { open: "Aperta", closing: "In chiusura", closed: "Chiusa" };

export function OperatorVideoTable({ filters, title }: { filters: OperatorFilters; title?: string }) {
  const { t } = useI18n();
  const [sort, setSort] = useState<OperatorSort>("views");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const { data, isLoading } = useOperatorVideoList(filters, sort, dir, page, PAGE_SIZE);

  useEffect(() => setPage(0), [filters]);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const head = (label: string, key: OperatorSort, right = true) => (
    <TableHead className={right ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => {
          if (sort === key) setDir(dir === "desc" ? "asc" : "desc");
          else { setSort(key); setDir("desc"); }
          setPage(0);
        }}
        className={`inline-flex items-center gap-1 hover:text-foreground ${sort === key ? "text-foreground" : ""}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title ?? t("Storico video")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("{n} video totali", { n: formatViews(total) })}</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Account / Creator / Campagna")}</TableHead>
                {head(t("Pubblicato"), "published", false)}
                {head("Views", "views")}
                {head(t("Like"), "likes")}
                {head(t("Commenti"), "comments")}
                {head(t("Condivisioni"), "shares")}
                {head(t("Salvataggi"), "saves")}
                {head("ER%", "engagement")}
                <TableHead>{t("Format")}</TableHead>
                <TableHead>{t("Finestra")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">{t("Caricamento...")}</TableCell></TableRow>
              )}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">{t("Nessun video nel periodo selezionato")}</TableCell></TableRow>
              )}
              {data?.rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="max-w-[260px]">
                    <div className="font-medium">@{v.username.replace(/^@+/, "")}</div>
                    <div className="truncate text-xs text-muted-foreground">{v.creator_name ?? "-"} · {v.campaign_name}</div>
                    {v.caption && <div className="truncate text-[11px] text-muted-foreground/80">{v.caption}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{new Date(v.published_at).toLocaleDateString("it-IT")}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatViews(Number(v.views))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatViews(Number(v.likes))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatViews(Number(v.comments))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatViews(Number(v.shares))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatViews(Number(v.saves ?? 0))}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(v.engagement_pct).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.content_tag ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={v.window_status === "open" ? "default" : v.window_status === "closing" ? "secondary" : "outline"}>
                      {t(WINDOW_LABEL[v.window_status])}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`https://www.tiktok.com/@${v.username.replace(/^@+/, "")}/video/${v.tiktok_video_id}`}
                        target="_blank"
                        rel="noopener"
                        aria-label={t("Apri su TikTok")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("Pagina {page} di {total}", { page: page + 1, total: pages })}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

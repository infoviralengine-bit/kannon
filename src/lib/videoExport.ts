// Pure helpers to turn Top video rows into a spreadsheet (CSV or .xlsx).
import type { TopVideoRow } from "@/hooks/useVideoAnalytics";

export type ExportCell = string | number | Date | null;

export interface ExportColumn {
  header: string;
  width: number;
  get: (v: TopVideoRow) => ExportCell;
  kind?: "date" | "number" | "percent";
}

type Translate = (s: string, vars?: Record<string, string | number>) => string;

export function topVideoExportColumns(t: Translate): ExportColumn[] {
  return [
    { header: t("Account"), width: 22, get: (v) => `@${v.account_username}` },
    { header: t("Creator"), width: 22, get: (v) => v.creator_name ?? "" },
    { header: t("Campagna"), width: 22, get: (v) => v.campaign_name ?? "" },
    { header: t("Pubblicato"), width: 12, kind: "date", get: (v) => new Date(v.published_at) },
    { header: "Views", width: 12, kind: "number", get: (v) => Number(v.effective_views ?? 0) },
    { header: t("Like"), width: 10, kind: "number", get: (v) => Number(v.likes ?? 0) },
    { header: t("Commenti"), width: 10, kind: "number", get: (v) => Number(v.comments ?? 0) },
    { header: t("Condivisioni"), width: 12, kind: "number", get: (v) => Number(v.shares ?? 0) },
    { header: t("Salvataggi"), width: 12, kind: "number", get: (v) => Number(v.saves ?? 0) },
    { header: "ER%", width: 8, kind: "percent", get: (v) => Math.round(Number(v.engagement_pct ?? 0) * 100) / 100 },
    { header: t("Caption"), width: 60, get: (v) => v.caption ?? "" },
    { header: t("Hashtag"), width: 30, get: (v) => (v.hashtags ?? []).map((h) => `#${h.replace(/^#/, "")}`).join(" ") },
    { header: t("Audio"), width: 25, get: (v) => v.audio_name ?? "" },
    { header: t("Link TikTok"), width: 45, get: (v) => v.tiktok_url },
  ];
}

/** DD/MM/YYYY in UTC. */
export function formatExportDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function csvValue(cell: ExportCell, kind?: ExportColumn["kind"]): string {
  if (cell === null || cell === undefined) return "";
  let s: string;
  if (cell instanceof Date) s = formatExportDate(cell);
  else if (typeof cell === "number") s = kind === "percent" ? cell.toFixed(2) : String(cell);
  else s = cell;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Comma separated, CRLF line endings, UTF-8 BOM so Excel reads accents and emoji. */
export function buildTopVideosCsv(rows: TopVideoRow[], columns: ExportColumn[]): string {
  const lines = [columns.map((c) => csvValue(c.header)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvValue(c.get(r), c.kind)).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function buildTopVideosXlsx(rows: TopVideoRow[], columns: ExportColumn[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = columns.map((c) => ({ value: c.header, fontWeight: "bold" as const }));
  const body = rows.map((r) =>
    columns.map((c) => {
      const value = c.get(r);
      if (value === null || value === "") return null;
      if (value instanceof Date) return { value, type: Date, format: "dd/mm/yyyy" };
      if (typeof value === "number") return { value, type: Number, format: c.kind === "percent" ? "0.00" : "#,##0" };
      return { value, type: String };
    }),
  );
  return writeXlsxFile([header, ...body] as any, {
    columns: columns.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
  } as any).toBlob();
}

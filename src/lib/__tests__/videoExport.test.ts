import { describe, it, expect } from "vitest";
import { buildTopVideosCsv, topVideoExportColumns } from "@/lib/videoExport";
import type { TopVideoRow } from "@/hooks/useVideoAnalytics";

const t = (s: string) => s;

const row = (over: Partial<TopVideoRow> = {}): TopVideoRow => ({
  id: "1", tiktok_video_id: "7400", account_username: "kannon_it", creator_id: null, creator_name: "Anna",
  campaign_id: null, campaign_name: "Finanz", client_name: null, published_at: "2026-10-05T23:30:00Z",
  effective_views: 12000, raw_views: 12000, likes: 300, comments: 20, shares: 5, saves: 9,
  engagement_pct: 2.8333, window_status: "open", tiktok_url: "https://www.tiktok.com/@kannon_it/video/7400",
  caption: 'POV: "risparmi", senza fatica\nprova ora', hashtags: ["finanza", "#soldi"], audio_name: "suono originale",
  total_count: 1, ...over,
});

describe("Top video export", () => {
  it("includes the caption of each video, keeping commas, quotes and line breaks intact", () => {
    const csv = buildTopVideosCsv([row()], topVideoExportColumns(t));
    expect(csv).toContain('"POV: ""risparmi"", senza fatica\nprova ora"');
  });

  it("writes the publish date as DD/MM/YYYY in UTC and the TikTok link", () => {
    const csv = buildTopVideosCsv([row()], topVideoExportColumns(t));
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine.startsWith("@kannon_it,Anna,Finanz,05/10/2026,12000,300,20,5,9,2.83,Aperta,")).toBe(true);
    expect(dataLine.endsWith(",#finanza #soldi,suono originale,https://www.tiktok.com/@kannon_it/video/7400")).toBe(true);
  });

  it("exports one line per video plus the header", () => {
    const csv = buildTopVideosCsv([row(), row({ id: "2" }), row({ id: "3", caption: null })], topVideoExportColumns(t));
    // captions with line breaks are quoted, so count records by the header + video rows
    expect(csv.match(/https:\/\/www\.tiktok\.com/g)?.length).toBe(3);
  });
});

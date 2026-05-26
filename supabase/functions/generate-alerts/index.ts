import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const INACTIVE_DAYS = 5;
const VIRAL_THRESHOLD = 50_000;
const EXPIRING_DAYS = 7;

type AlertSpec = {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  link: string | null;
  meta: Record<string, unknown> & { ref: string };
  campaign_id?: string | null;
  recipientRoles: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const alerts: AlertSpec[] = [];
  const nowIso = new Date().toISOString();

  try {
    // 1) Inactive creators (active, joined to a campaign, no videos in last N days)
    const inactiveSinceIso = new Date(Date.now() - INACTIVE_DAYS * 86400_000).toISOString();
    const { data: activeCreators } = await admin
      .from("creators")
      .select("id, name")
      .eq("status", "active");

    if (activeCreators?.length) {
      const ids = activeCreators.map((c) => c.id);
      const { data: recentVideos } = await admin
        .from("videos")
        .select("tiktok_account_id, published_at, tiktok_accounts!inner(creator_id)")
        .gte("published_at", inactiveSinceIso)
        .in("tiktok_accounts.creator_id", ids);
      const activeIds = new Set(
        (recentVideos ?? []).map((v: any) => v.tiktok_accounts?.creator_id).filter(Boolean),
      );
      for (const c of activeCreators) {
        if (!activeIds.has(c.id)) {
          alerts.push({
            type: "inactive_creator",
            severity: "warning",
            message: `${c.name} non pubblica da oltre ${INACTIVE_DAYS} giorni`,
            link: `/dashboard/creators/${c.id}`,
            meta: { ref: `inactive_creator:${c.id}`, creator_id: c.id, creator_name: c.name },
            recipientRoles: ["admin", "team", "campaign_manager"],
          });
        }
      }
    }

    // 2) Viral videos (last 24h, views > threshold)
    const yesterdayIso = new Date(Date.now() - 86400_000).toISOString();
    const { data: viral } = await admin
      .from("videos")
      .select("id, views, published_at, tiktok_video_id, tiktok_accounts!inner(username, campaign_id, creator_id, creators(name), campaigns(name))")
      .gte("published_at", yesterdayIso)
      .gt("views", VIRAL_THRESHOLD)
      .order("views", { ascending: false })
      .limit(50);
    for (const v of (viral ?? []) as any[]) {
      const creatorName = v.tiktok_accounts?.creators?.name ?? v.tiktok_accounts?.username ?? "creator";
      const campaignId = v.tiktok_accounts?.campaign_id ?? null;
      const campaignName = v.tiktok_accounts?.campaigns?.name ?? "—";
      const views = v.views ?? 0;
      alerts.push({
        type: "viral_video",
        severity: "info",
        message: `Video virale: ${creatorName} • ${views.toLocaleString("it-IT")} views (${campaignName})`,
        link: campaignId ? `/dashboard/campaigns/${campaignId}` : null,
        meta: { ref: `viral_video:${v.id}`, video_id: v.id, views, campaign_id: campaignId },
        campaign_id: campaignId,
        recipientRoles: ["admin", "campaign_manager"],
      });
    }

    // 3) Expiring contracts (campaigns with end_date in next 7d)
    const in7d = new Date(Date.now() + EXPIRING_DAYS * 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const { data: expiringCamps } = await admin
      .from("campaigns")
      .select("id, name, end_date")
      .eq("status", "active")
      .gte("end_date", today)
      .lte("end_date", in7d);
    for (const c of expiringCamps ?? []) {
      alerts.push({
        type: "expiring_contract",
        severity: "warning",
        message: `Campagna ${c.name} in scadenza il ${new Date(c.end_date as string).toLocaleDateString("it-IT")}`,
        link: `/dashboard/campaigns/${c.id}`,
        meta: { ref: `expiring_campaign:${c.id}`, campaign_id: c.id, end_date: c.end_date },
        campaign_id: c.id,
        recipientRoles: ["admin", "team"],
      });
    }

    // 4) Payment cycles to close (cycle_end_date <= today, no client_payments)
    const { data: cycles } = await admin
      .from("payment_cycles")
      .select("id, cycle_number, cycle_end_date, campaign_id, campaigns(name)")
      .lte("cycle_end_date", today);
    if (cycles?.length) {
      const cycleIds = cycles.map((c) => c.id);
      const { data: payments } = await admin
        .from("client_payments")
        .select("cycle_id")
        .in("cycle_id", cycleIds);
      const paid = new Set((payments ?? []).map((p) => p.cycle_id));
      for (const cyc of cycles as any[]) {
        if (!paid.has(cyc.id)) {
          alerts.push({
            type: "cycle_to_close",
            severity: "warning",
            message: `Ciclo #${cyc.cycle_number} ${cyc.campaigns?.name ?? ""} da chiudere`,
            link: `/dashboard/payoff`,
            meta: { ref: `cycle_to_close:${cyc.id}`, cycle_id: cyc.id, campaign_id: cyc.campaign_id },
            campaign_id: cyc.campaign_id,
            recipientRoles: ["admin", "team"],
          });
        }
      }
    }

    // Recipients lookup
    const allRoles = Array.from(new Set(alerts.flatMap((a) => a.recipientRoles)));
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", allRoles);
    const usersByRole = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const arr = usersByRole.get(r.role) ?? [];
      arr.push(r.user_id);
      usersByRole.set(r.role, arr);
    }

    // Dedup: skip alerts whose meta.ref already exists in last 24h
    const refs = alerts.map((a) => a.meta.ref);
    const since24Iso = new Date(Date.now() - 86400_000).toISOString();
    const existingRefs = new Set<string>();
    if (refs.length) {
      // chunk to avoid query size
      for (let i = 0; i < refs.length; i += 200) {
        const slice = refs.slice(i, i + 200);
        const { data: existing } = await admin
          .from("notifications")
          .select("meta")
          .gte("created_at", since24Iso)
          .in("type", Array.from(new Set(alerts.map((a) => a.type))))
          .or(slice.map((r) => `meta->>ref.eq.${r}`).join(","));
        for (const e of existing ?? []) {
          const ref = (e.meta as any)?.ref;
          if (ref) existingRefs.add(ref);
        }
      }
    }

    const rows: any[] = [];
    for (const a of alerts) {
      if (existingRefs.has(a.meta.ref)) continue;
      const recipientIds = new Set<string>();
      for (const role of a.recipientRoles) {
        for (const uid of usersByRole.get(role) ?? []) recipientIds.add(uid);
      }
      for (const uid of recipientIds) {
        rows.push({
          user_id: uid,
          campaign_id: a.campaign_id ?? null,
          type: a.type,
          message: a.message,
          severity: a.severity,
          link: a.link,
          meta: a.meta,
        });
      }
    }

    if (rows.length) {
      for (let i = 0; i < rows.length; i += 200) {
        await admin.from("notifications").insert(rows.slice(i, i + 200));
      }
    }

    return new Response(
      JSON.stringify({ ok: true, generated: rows.length, candidates: alerts.length, at: nowIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-alerts error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
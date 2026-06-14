// Shared authorization helper for destructive edge functions.
// Accepts EITHER:
//   - "x-cron-secret" header equal to env CRON_SECRET (system/cron caller), OR
//   - "Authorization: Bearer <jwt>" of a user that has role 'admin' in user_roles.
// Returns null when authorized, otherwise a ready-to-return Response (401/403/500).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AuthResult = { ok: true } | { ok: false; response: Response };

/**
 * Build CORS headers restricted to APP_ORIGIN.
 * APP_ORIGIN is a comma-separated list of allowed origins.
 * If the request's Origin header matches one of them, that origin is echoed back.
 * If APP_ORIGIN is unset, falls back to "*" (dev/legacy behaviour) — set it in prod.
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };

  const appOrigin = Deno.env.get("APP_ORIGIN");
  const reqOrigin = req.headers.get("Origin") ?? "";

  if (!appOrigin) {
    return { ...baseHeaders, "Access-Control-Allow-Origin": "*" };
  }

  const allowed = appOrigin.split(",").map((o) => o.trim()).filter(Boolean);
  if (reqOrigin && allowed.includes(reqOrigin)) {
    return { ...baseHeaders, "Access-Control-Allow-Origin": reqOrigin };
  }

  // Origin not allowed: still answer with the first configured one so that
  // server-to-server / curl calls (no Origin header) keep working, but
  // browsers from other origins will be blocked by the browser itself.
  return { ...baseHeaders, "Access-Control-Allow-Origin": allowed[0] };
}

export async function assertAuthorized(
  req: Request,
  supabaseAdmin: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<AuthResult> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // 1) Cron / system caller
  const cronSecret = Deno.env.get("CRON_SECRET");
  const incomingCronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && incomingCronSecret && incomingCronSecret === cronSecret) {
    return { ok: true };
  }

  // 2) Authenticated admin caller
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Unauthorized: missing credentials" }),
        { status: 401, headers: jsonHeaders },
      ),
    };
  }

  const token = authHeader.slice(7).trim();

  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "Unauthorized: invalid token" }),
          { status: 401, headers: jsonHeaders },
        ),
      };
    }

    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "Authorization check failed" }),
          { status: 500, headers: jsonHeaders },
        ),
      };
    }

    if (!roleRow) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "Forbidden: admin role required" }),
          { status: 403, headers: jsonHeaders },
        ),
      };
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Authorization check failed", detail: String(e) }),
        { status: 500, headers: jsonHeaders },
      ),
    };
  }
}
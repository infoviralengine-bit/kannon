// Shared authorization helper for destructive edge functions.
// Accepts EITHER:
//   - "x-cron-secret" header equal to env CRON_SECRET (system/cron caller), OR
//   - "Authorization: Bearer <jwt>" of a user that has role 'admin' in user_roles.
// Returns null when authorized, otherwise a ready-to-return Response (401/403/500).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AuthResult = { ok: true } | { ok: false; response: Response };

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
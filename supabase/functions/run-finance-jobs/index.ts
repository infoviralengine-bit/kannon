import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertAuthorized, buildCorsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = await assertAuthorized(req, supabase, cors);
  if (!auth.ok) return auth.response;

  const results: Record<string, unknown> = {};

  const { data: gen, error: genErr } = await supabase.rpc(
    "generate_recurring_expense_entries",
    { p_months_ahead: 3 },
  );
  results.generated_recurring = genErr ? { error: genErr.message } : gen;

  const today = new Date();
  const in3 = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const { data: dueSoon, error: dueErr } = await supabase
    .from("v_financial_movements")
    .select("id, description, amount, due_date")
    .eq("status", "expected")
    .lte("due_date", in3)
    .gte("due_date", todayStr);

  results.due_soon_count = dueErr ? { error: dueErr.message } : (dueSoon?.length ?? 0);

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
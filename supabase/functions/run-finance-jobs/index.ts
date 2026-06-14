import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
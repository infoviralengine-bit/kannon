import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertAuthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const addDays = (d: Date, days: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
};
const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await assertAuthorized(req, supa, corsHeaders);
    if (!auth.ok) return auth.response;

    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    const { data: camp, error: campErr } = await supa
      .from("campaigns")
      .select("id, name, client_fixed, client_cpm, payment_terms, start_date, end_date")
      .eq("id", campaign_id)
      .single();
    if (campErr || !camp) throw campErr ?? new Error("Campaign not found");
    if (!camp.start_date || !camp.end_date) throw new Error("Campaign missing start_date or end_date");

    const terms = (camp.payment_terms ?? { type: "standard_lagged" }) as any;

    const { error: delErr } = await supa
      .from("client_payments")
      .delete()
      .eq("campaign_id", campaign_id)
      .eq("is_paid", false);
    if (delErr) throw delErr;

    const newPayments: any[] = [];
    const startDate = new Date(camp.start_date);
    const endDate = new Date(camp.end_date);

    if (terms.type === "tot_split") {
      const firstHalfDay = Math.max(1, Math.min(28, terms.firstHalfDay ?? 1));
      const secondHalfDay = Math.max(firstHalfDay + 1, Math.min(28, terms.secondHalfDay ?? 28));
      const cpmDelay = terms.cpmPayoutDelayDays ?? 30;
      const halfFixed = Number(camp.client_fixed ?? 0) / 2;

      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const cycleLength = 30;
      const numCycles = Math.max(1, Math.ceil(totalDays / cycleLength));

      for (let i = 0; i < numCycles; i++) {
        const cycleStart = addDays(startDate, i * cycleLength);
        const firstHalfDate = addDays(cycleStart, firstHalfDay - 1);
        const secondHalfDate = addDays(cycleStart, secondHalfDay - 1);
        const cycleNum = i + 1;
        const limit = addDays(endDate, 30);

        if (firstHalfDate >= startDate && firstHalfDate <= limit) {
          newPayments.push({
            campaign_id, cycle_id: null,
            cycle_number: cycleNum,
            due_date: toIsoDate(firstHalfDate),
            fixed_amount: halfFixed, cpm_views: 0, cpm_amount: 0,
            total_amount: halfFixed, views_paid_cumulative: 0,
            is_paid: false, payment_kind: "tot_fixed_first",
          });
        }
        if (secondHalfDate >= startDate && secondHalfDate <= limit) {
          newPayments.push({
            campaign_id, cycle_id: null,
            cycle_number: cycleNum,
            due_date: toIsoDate(secondHalfDate),
            fixed_amount: halfFixed, cpm_views: 0, cpm_amount: 0,
            total_amount: halfFixed, views_paid_cumulative: 0,
            is_paid: false, payment_kind: "tot_fixed_second",
          });
        }
      }

      const finalDue = addDays(endDate, cpmDelay);
      newPayments.push({
        campaign_id, cycle_id: null,
        cycle_number: numCycles + 1,
        due_date: toIsoDate(finalDue),
        fixed_amount: 0, cpm_views: 0, cpm_amount: 0,
        total_amount: 0, views_paid_cumulative: 0,
        is_paid: false, payment_kind: "tot_final_cpm",
      });
    } else {
      const { data: cycles } = await supa
        .from("payment_cycles")
        .select("id, cycle_number, cycle_start_date, cycle_end_date, is_last_cycle")
        .eq("campaign_id", campaign_id)
        .order("cycle_number", { ascending: true });

      const fixedDueDay = Math.max(1, Math.min(28, terms.fixedDueDay ?? 1));
      const clientFixed = Number(camp.client_fixed ?? 0);

      (cycles ?? []).forEach((c: any) => {
        const dueDate = new Date(c.cycle_end_date);
        dueDate.setDate(fixedDueDay);
        newPayments.push({
          campaign_id, cycle_id: c.id,
          cycle_number: c.cycle_number,
          due_date: toIsoDate(dueDate),
          fixed_amount: c.is_last_cycle ? 0 : clientFixed,
          cpm_views: 0, cpm_amount: 0,
          total_amount: c.is_last_cycle ? 0 : clientFixed,
          views_paid_cumulative: 0,
          is_paid: false, payment_kind: "standard",
        });
      });
    }

    if (newPayments.length) {
      const { error: insErr } = await supa.from("client_payments").insert(newPayments);
      if (insErr) throw insErr;
    }

    return new Response(
      JSON.stringify({ ok: true, generated: newPayments.length, terms }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify Calendly webhook signature
    const calendlySignature = req.headers.get("Calendly-Webhook-Signature");
    const body = await req.text();

    // Get webhook secret from settings
    const { data: secretSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "calendly_webhook_secret")
      .single();

    if (secretSetting?.value && calendlySignature) {
      // Parse signature header: t=timestamp,v1=signature
      const parts = calendlySignature.split(",");
      const timestamp = parts.find((p: string) => p.startsWith("t="))?.slice(2);
      const signature = parts.find((p: string) => p.startsWith("v1="))?.slice(3);

      if (timestamp && signature) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(secretSetting.value),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const signaturePayload = `${timestamp}.${body}`;
        const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(signaturePayload));
        const expectedHex = Array.from(new Uint8Array(expectedSig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (expectedHex !== signature) {
          console.error("Invalid Calendly webhook signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const payload = JSON.parse(body);
    const event = payload.event;

    // Only process invitee.created events
    if (event !== "invitee.created") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invitee = payload.payload;
    const name = invitee.name || "";
    const nameParts = name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const email = invitee.email || "";
    const scheduledAt = invitee.scheduled_event?.start_time || new Date().toISOString();

    const { error } = await supabase.from("closer_leads").insert({
      first_name: firstName,
      last_name: lastName,
      email: email,
      call_datetime: scheduledAt,
      source: "calendly",
    });

    if (error) {
      console.error("Error inserting lead:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

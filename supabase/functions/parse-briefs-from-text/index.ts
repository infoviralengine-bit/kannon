import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Sei un parser specializzato in brief video TikTok per Kannon, agenzia di user acquisition B2B.

L'utente ti incolla il testo di una tabella settimanale di brief estratta da un Google Doc. Ogni riga della tabella è un brief = un video pianificato.

La struttura tipica della tabella ha 4 colonne:
1. Data (formato dd/mm es. 08/06, 10/06)
2. Video/Audio (link TikTok di riferimento, etichettati come "Video", "Audio", "Video e audio", "Format e audio", "Format")
3. Copy (testo che il creator dirà nel video, seguito da sezione "Caption" col testo del post e poi una lista di hashtag tipo #imprenditore #fintech)
4. Visuale (indicazioni visuali tipo "Copiare il video", "Foto 1: ... Foto 2: ...")

Il tuo compito è restituire JSON con un array di brief estratti. SCHEMA RIGOROSO:

{
  "briefs": [
    {
      "planned_publish_date": "YYYY-MM-DD",
      "title": "breve titolo evocativo del brief",
      "reference_type": "video" | "audio" | "video_audio" | "format_audio" | "format",
      "reference_links": [
        { "label": "Video" | "Audio" | "Format", "url": "https://www.tiktok.com/..." }
      ],
      "copy_text": "testo completo del copy",
      "caption": "testo della caption del post, null se assente",
      "hashtags": ["imprenditore", "azienda", "fintech"],
      "visual_note": "indicazioni visuali, null se assente",
      "audio_id": null,
      "expected_caption_keywords": [],
      "format_id": null,
      "topic_ids": []
    }
  ]
}

REGOLE FERREE:
- Restituisci SOLO JSON valido, niente testo prima/dopo, niente markdown code fences.
- Se non riesci a estrarre nemmeno un brief, restituisci { "briefs": [] }.
- Per le date dd/mm: anno corrente è ${new Date().getFullYear()}, se la data risultante è nel passato di oltre 6 mesi assumi anno prossimo.
- Niente em dash nei testi estratti (sostituisci con ',' o ':').
- Mantieni lingua originale (italiano).
- Hashtag senza '#' e lowercase.
- Link TikTok devono iniziare con 'https://www.tiktok.com/' o 'https://vm.tiktok.com/'; scarta link non TikTok.
- Se trovi solo label ("Video", "Audio") senza URL, includi entry con url: "" (stringa vuota) cosi la CM la completa nella preview.
- Se una riga ha solo dati parziali, includila comunque con i campi noti e null/[] per i mancanti.`;

const USER_PROMPT = (rawText: string, campaignName?: string) => `
Campagna corrente: ${campaignName ?? "(non specificata)"}

Testo incollato dal Google Doc:
---
${rawText}
---

Estrai i brief in JSON secondo lo schema.`;

async function verifyStaffCaller(req: Request, supabaseAdmin: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Authorization header" };
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: claims, error } = await userClient.auth.getUser();
  if (error || !claims?.user) return { ok: false, status: 401, error: "Invalid token" };

  const { data: role } = await supabaseAdmin.rpc("get_user_role", { _user_id: claims.user.id });
  if (!["admin", "team", "campaign_manager"].includes(role)) {
    return { ok: false, status: 403, error: "Forbidden: staff only" };
  }
  return { ok: true, userId: claims.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const auth = await verifyStaffCaller(req, supabaseAdmin);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const rawText = body?.raw_text as string | undefined;
  const campaignName = body?.campaign_context?.campaign_name as string | undefined;

  if (!rawText || rawText.length < 20) {
    return new Response(JSON.stringify({ ok: false, error: "raw_text mancante o troppo corto" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 4096,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: USER_PROMPT(rawText, campaignName) }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API ${anthropicResponse.status}: ${errText}`);
    }

    const result = await anthropicResponse.json();
    let llmText = result.content?.[0]?.text as string;
    if (!llmText) throw new Error("Empty LLM response");

    // Defensive: strip accidental markdown code fences before parsing.
    llmText = llmText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(llmText);
    } catch {
      throw new Error(`LLM returned invalid JSON: ${llmText.slice(0, 200)}`);
    }

    return new Response(JSON.stringify({ ok: true, briefs: parsed.briefs ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("parse-briefs-from-text error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

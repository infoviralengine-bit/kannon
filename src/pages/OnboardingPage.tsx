import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, CheckCircle, AlertTriangle, Eye, EyeOff, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingLink {
  id: string;
  token: string;
  contract_ids: string[];
  status: string;
  closer_leads: { first_name: string; last_name: string } | null;
}

interface Contract {
  id: string;
  name: string;
  contract_text: string;
  creator_cpm: number;
  creator_fixed: number;
  min_videos_per_day: number;
}

interface CampaignInfo {
  campaign_id: string;
  campaign_name: string;
  contract_id: string;
}

/* ── Validation helpers ── */
const validateFiscalCode = (v: string) => /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(v.trim());
const validateIBAN = (v: string) => {
  const clean = v.replace(/\s/g, "").toUpperCase();
  return /^IT\d{2}[A-Z]\d{22}$/.test(clean) && clean.length === 27;
};

export default function OnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [link, setLink] = useState<OnboardingLink | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Step 1 - Personal
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [province, setProvince] = useState("");

  // Step 2 - Payment
  const [iban, setIban] = useState("");
  const [ibanConfirm, setIbanConfirm] = useState("");
  const [ibanHolder, setIbanHolder] = useState("");

  // Step 3 - TikTok
  const [tiktokUsernames, setTiktokUsernames] = useState<Record<string, string>>({}); // keyed by campaign_id

  // Step 4 - Contracts & Auth
  const [acceptedContracts, setAcceptedContracts] = useState<Record<string, boolean>>({});
  const [scrolledContracts, setScrolledContracts] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Load onboarding link data
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: linkData, error: linkErr } = await supabase
        .from("onboarding_links")
        .select("*, closer_leads(first_name, last_name)")
        .eq("token", token)
        .single();

      if (linkErr || !linkData) {
        setError("Link non valido o scaduto.");
        setLoading(false);
        return;
      }
      if (linkData.status === "completed") {
        setError("Questo link è già stato utilizzato.");
        setLoading(false);
        return;
      }

      setLink(linkData as unknown as OnboardingLink);

      if (linkData.closer_leads) {
        setFirstName((linkData.closer_leads as any).first_name || "");
        setLastName((linkData.closer_leads as any).last_name || "");
      }

      // Load contracts
      const { data: cData } = await supabase
        .from("contracts")
        .select("id, name, contract_text, creator_cpm, creator_fixed, min_videos_per_day")
        .in("id", linkData.contract_ids);

      setContracts((cData ?? []) as Contract[]);

      // Load campaigns linked to these contracts
      const { data: ccData } = await supabase
        .from("contract_campaigns")
        .select("contract_id, campaign_id, campaigns(name)")
        .in("contract_id", linkData.contract_ids);

      const campaignInfos: CampaignInfo[] = (ccData ?? []).map((cc: any) => ({
        campaign_id: cc.campaign_id,
        campaign_name: cc.campaigns?.name || "Campagna",
        contract_id: cc.contract_id,
      }));
      // Deduplicate by campaign_id
      const uniqueCampaigns = Array.from(
        new Map(campaignInfos.map(c => [c.campaign_id, c])).values()
      );
      setCampaigns(uniqueCampaigns);

      setLoading(false);
    })();
  }, [token]);

  const stepLabels = ["Dati personali", "Pagamento", "Account TikTok", "Firma e accesso"];
  const progressValue = ((step + 1) / 4) * 100;

  /* ── Step validation ── */
  const canProceedStep0 = firstName.trim() && lastName.trim() && dob && validateFiscalCode(fiscalCode) && street.trim() && city.trim() && zip.trim() && province.trim();
  const canProceedStep1 = iban.trim() && validateIBAN(iban) && iban.replace(/\s/g, "").toUpperCase() === ibanConfirm.replace(/\s/g, "").toUpperCase() && ibanHolder.trim();
  const canProceedStep2 = campaigns.length > 0 && campaigns.every(c => tiktokUsernames[c.campaign_id]?.trim());
  const allContractsAccepted = contracts.every(c => acceptedContracts[c.id]);
  const canSubmit = allContractsAccepted && email.trim() && password.length >= 6;

  const handleSubmit = async () => {
    if (!link) return;
    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke("complete-onboarding", {
        body: {
          token,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob,
          fiscal_code: fiscalCode.trim().toUpperCase(),
          address_street: street.trim(),
          address_city: city.trim(),
          address_zip: zip.trim(),
          address_province: province.trim().toUpperCase(),
          iban: iban.replace(/\s/g, "").toUpperCase(),
          iban_holder_name: ibanHolder.trim(),
          tiktok_usernames: tiktokUsernames,
          email: email.trim(),
          password,
        },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Errore durante la registrazione");
        setSubmitting(false);
        return;
      }

      navigate("/onboarding/completed");
    } catch {
      toast.error("Errore di connessione");
      setSubmitting(false);
    }
  };

  /* ── Contract scroll detection ── */
  const handleContractScroll = useCallback((contractId: string, el: HTMLDivElement) => {
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (atBottom) {
      setScrolledContracts(prev => ({ ...prev, [contractId]: true }));
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(240,15%,5%)] flex items-center justify-center">
        <div className="animate-pulse text-white/60 text-sm">Caricamento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[hsl(240,15%,5%)] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-white">Link non valido</h1>
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(240,15%,5%)] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[hsl(254,100%,64%)]" />
            <span className="text-lg font-bold tracking-tight">Kannon</span>
          </div>
          <span className="text-xs text-white/40">Onboarding Creator</span>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between mb-2">
          {stepLabels.map((label, i) => (
            <span
              key={i}
              className={`text-[11px] font-medium transition-colors ${
                i === step ? "text-[hsl(254,100%,64%)]" : i < step ? "text-white/60" : "text-white/25"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
        <Progress value={progressValue} className="h-1.5 bg-white/10" />
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* ── Step 0: Personal ── */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Ciao{firstName ? ` ${firstName}` : ""}! 👋</h2>
              <p className="text-sm text-white/60 mt-1">
                Iniziamo con i tuoi dati personali. Ci servono per creare il tuo contratto e gestire i pagamenti.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome" value={firstName} onChange={setFirstName} placeholder="Mario" />
              <Field label="Cognome" value={lastName} onChange={setLastName} placeholder="Rossi" />
            </div>

            <Field label="Data di nascita" type="date" value={dob} onChange={setDob} />

            <div>
              <Field
                label="Codice Fiscale"
                value={fiscalCode}
                onChange={(v) => setFiscalCode(v.toUpperCase())}
                placeholder="RSSMRA90A01H501Z"
                maxLength={16}
              />
              {fiscalCode && !validateFiscalCode(fiscalCode) && (
                <p className="text-xs text-destructive mt-1">Formato codice fiscale non valido</p>
              )}
            </div>

            <Field label="Indirizzo" value={street} onChange={setStreet} placeholder="Via Roma 1" />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Città" value={city} onChange={setCity} placeholder="Roma" />
              <Field label="CAP" value={zip} onChange={setZip} placeholder="00100" maxLength={5} />
              <Field label="Provincia" value={province} onChange={(v) => setProvince(v.toUpperCase())} placeholder="RM" maxLength={2} />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep(1)}
                disabled={!canProceedStep0}
                className="bg-[hsl(254,100%,64%)] hover:bg-[hsl(254,100%,58%)] text-white px-8"
              >
                Continua
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 1: Payment ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Dati di pagamento 💰</h2>
              <p className="text-sm text-white/60 mt-1">
                Inserisci il tuo IBAN per ricevere i compensi. Controlla bene: un errore potrebbe causare ritardi nei pagamenti.
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200">
                  Assicurati che l'IBAN sia corretto e che il conto sia intestato a te. Un errore può causare ritardi significativi nei pagamenti.
                </p>
              </div>
            </div>

            <Field label="Intestatario conto" value={ibanHolder} onChange={setIbanHolder} placeholder="Mario Rossi" />

            <div>
              <Field label="IBAN" value={iban} onChange={(v) => setIban(v.toUpperCase())} placeholder="IT60X0542811101000000123456" maxLength={34} />
              {iban && !validateIBAN(iban) && (
                <p className="text-xs text-destructive mt-1">L'IBAN deve essere italiano (IT) e avere 27 caratteri</p>
              )}
            </div>

            <div>
              <Field label="Conferma IBAN" value={ibanConfirm} onChange={(v) => setIbanConfirm(v.toUpperCase())} placeholder="IT60X0542811101000000123456" maxLength={34} />
              {ibanConfirm && iban.replace(/\s/g, "").toUpperCase() !== ibanConfirm.replace(/\s/g, "").toUpperCase() && (
                <p className="text-xs text-destructive mt-1">Gli IBAN non corrispondono</p>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(0)} className="text-white/60">Indietro</Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="bg-[hsl(254,100%,64%)] hover:bg-[hsl(254,100%,58%)] text-white px-8"
              >
                Continua
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: TikTok ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">I tuoi account TikTok 📱</h2>
              <p className="text-sm text-white/60 mt-1">
                Per ogni campagna ti serve un account TikTok dedicato. Inserisci il tuo username (quello che inizia con @).
              </p>
            </div>

            {/* Banner riepilogo */}
            <div className="rounded-xl border border-[hsl(254,100%,64%)]/30 bg-[hsl(254,100%,64%)]/10 p-4">
              <p className="text-sm font-semibold mb-2">
                Devi creare {campaigns.length} account TikTok dedicat{campaigns.length === 1 ? "o" : "i"}:
              </p>
              <ul className="space-y-1">
                {campaigns.map(c => (
                  <li key={c.campaign_id} className="text-sm text-white/70 flex items-center gap-2">
                    <span className="text-[hsl(254,100%,64%)]">•</span>
                    1 per <span className="font-medium text-white">{c.campaign_name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 1 — Di cosa hai bisogno */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold">📧 Di cosa hai bisogno</h3>
              <p className="text-sm text-white/60">
                Per ogni account TikTok ti serve una email dedicata. Usa Gmail se possibile. Se hai esaurito gli account Gmail, usa ProtonMail (proton.me) — è gratuito.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white/80 hover:bg-white/10"
                onClick={() => window.open("https://proton.me", "_blank")}
              >
                Apri ProtonMail →
              </Button>
            </div>

            {/* Card 2 — Crea il tuo profilo */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <h3 className="text-sm font-semibold">🎭 Crea il tuo profilo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="font-medium text-green-400">✅ Fai così</p>
                  <ul className="space-y-1.5 text-white/60">
                    <li>Handle casual e organico (es. @marco.creator)</li>
                    <li>Nome visualizzato semplice e personale</li>
                    <li>Foto profilo: selfie o foto spontanea</li>
                    <li>Bio breve e autentica</li>
                    <li>Verifica l'account nelle impostazioni TikTok</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-red-400">❌ Evita</p>
                  <ul className="space-y-1.5 text-white/60">
                    <li>Nomi corporate o spammy (es. @promofinanza2024)</li>
                    <li>Nome che sembra un brand</li>
                    <li>Logo o immagini corporate</li>
                    <li>Frasi promozionali o troppo formali</li>
                    <li>Lasciare il profilo incompleto</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Card 3 — Crea tutti gli account ora */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
              <h3 className="text-sm font-semibold">⚡ Crea tutti gli account ora</h3>
              <p className="text-sm text-white/60">
                Non puoi procedere senza aver creato tutti gli account e inserito gli username. Prenditi il tempo necessario — questo è il momento giusto per farlo.
              </p>
            </div>

            {/* Username fields per campaign */}
            {campaigns.map((c, i) => (
              <div key={c.campaign_id} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Account per {c.campaign_name}</span>
                  <span className="text-xs text-white/40">Account {i + 1} di {campaigns.length}</span>
                </div>
                <Field
                  label="Username TikTok"
                  value={tiktokUsernames[c.campaign_id] || ""}
                  onChange={(v) => setTiktokUsernames(prev => ({ ...prev, [c.campaign_id]: v }))}
                  placeholder="@tuousername"
                />
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="text-white/60">Indietro</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="bg-[hsl(254,100%,64%)] hover:bg-[hsl(254,100%,58%)] text-white px-8"
              >
                Continua
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Contracts & Auth ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Firma i contratti e crea il tuo accesso ✍️</h2>
              <p className="text-sm text-white/60 mt-1">
                Leggi attentamente ogni contratto fino in fondo. Potrai accettarlo solo dopo averlo letto tutto.
              </p>
            </div>

            {contracts.map(c => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                  <span className="text-sm font-semibold">{c.name}</span>
                  {acceptedContracts[c.id] && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <div
                  className="px-5 py-4 max-h-60 overflow-y-auto text-xs text-white/70 whitespace-pre-wrap leading-relaxed"
                  onScroll={(e) => handleContractScroll(c.id, e.currentTarget)}
                >
                  {c.contract_text || "Testo del contratto non ancora disponibile. Contatta il team per assistenza."}
                </div>
                <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={!!acceptedContracts[c.id]}
                      disabled={!scrolledContracts[c.id]}
                      onCheckedChange={(checked) =>
                        setAcceptedContracts(prev => ({ ...prev, [c.id]: !!checked }))
                      }
                    />
                    <span className={`text-xs ${scrolledContracts[c.id] ? "text-white/80" : "text-white/30"}`}>
                      {scrolledContracts[c.id]
                        ? "Ho letto e accetto i termini di questo contratto"
                        : "Scorri fino in fondo per accettare"}
                    </span>
                  </label>
                </div>
              </div>
            ))}

            {/* Credentials */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Crea il tuo accesso</h3>
                <p className="text-xs text-white/50">Queste credenziali ti serviranno per accedere alla tua area personale dove potrai monitorare i tuoi guadagni e le tue statistiche.</p>
              </div>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="tua@email.com" />
              <div>
                <Label className="text-xs text-white/70 mb-1.5 block">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 6 caratteri"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && password.length < 6 && (
                  <p className="text-xs text-destructive mt-1">La password deve avere almeno 6 caratteri</p>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="text-white/60">Indietro</Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="bg-[hsl(254,100%,64%)] hover:bg-[hsl(254,100%,58%)] text-white px-8"
              >
                {submitting ? "Registrazione in corso..." : "Completa registrazione"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Reusable Field component ── */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <Label className="text-xs text-white/70 mb-1.5 block">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
      />
    </div>
  );
}

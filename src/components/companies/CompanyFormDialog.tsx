import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveCompany, useStaffProfiles, useUploadCompanyLogo, type Company } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";
import { CompanyLogo } from "@/components/companies/CompanyLogo";
import {
  COMPANY_STAGES, STAGE_LABEL, COMPANY_STATUSES, STATUS_LABEL,
  TEMPERATURES, TEMPERATURE_LABEL, DEAL_TYPES, DEAL_TYPE_LABEL,
  GROWTH_STAGES, GROWTH_STAGE_LABEL,
  SOURCE_CHANNELS, dealNeedsCpm, dealNeedsFixed, dealNeedsPerformance,
  type DealType,
} from "@/lib/companies";

const NONE = "__none__";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company?: Company | null;
};

export function CompanyFormDialog({ open, onOpenChange, company }: Props) {
  const { t } = useI18n();
  const save = useSaveCompany();
  const uploadLogo = useUploadCompanyLogo();
  const { data: staff = [] } = useStaffProfiles();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [status, setStatus] = useState("lead");
  const [stage, setStage] = useState("nuova");
  const [temperature, setTemperature] = useState(NONE);
  const [sourceChannel, setSourceChannel] = useState(NONE);
  const [ownerId, setOwnerId] = useState(NONE);
  const [sector, setSector] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savedCompanyId, setSavedCompanyId] = useState<string | null>(null);
  const [appName, setAppName] = useState("");
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [playStoreUrl, setPlayStoreUrl] = useState("");
  const [country, setCountry] = useState("");
  const [growthStage, setGrowthStage] = useState(NONE);
  const [dealType, setDealType] = useState(NONE);
  const [dealFixed, setDealFixed] = useState("");
  const [dealCpm, setDealCpm] = useState("");
  const [dealViews, setDealViews] = useState("");
  const [dealPct, setDealPct] = useState("");
  const [dealPctNote, setDealPctNote] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? "");
    setLegalName(company?.legal_name ?? "");
    setStatus(company?.status ?? "lead");
    setStage(company?.stage ?? "nuova");
    setTemperature(company?.temperature ?? NONE);
    setSourceChannel(company?.source_channel ?? NONE);
    setOwnerId(company?.owner_id ?? NONE);
    setSector(company?.sector ?? "");
    setWebsite(company?.website ?? "");
    setLogoUrl(company?.logo_url ?? "");
    setLogoFile(null);
    setLogoPreview(null);
    setSavedCompanyId(company?.id ?? null);
    setAppName(company?.app_name ?? "");
    setAppStoreUrl(company?.app_store_url ?? "");
    setPlayStoreUrl(company?.play_store_url ?? "");
    setCountry(company?.country ?? "");
    setGrowthStage(company?.growth_stage ?? NONE);
    setDealType(company?.deal_type ?? NONE);
    setDealFixed(company?.deal_fixed?.toString() ?? "");
    setDealCpm(company?.deal_cpm?.toString() ?? "");
    setDealViews(company?.deal_estimated_views?.toString() ?? "");
    setDealPct(company?.deal_performance_pct?.toString() ?? "");
    setDealPctNote(company?.deal_performance_note ?? "");
    setMonthlyValue(company?.estimated_monthly_value?.toString() ?? "");
    setNextStep(company?.next_step ?? "");
    setNextStepDate(company?.next_step_date ?? "");
    setLostReason(company?.lost_reason ?? "");
    setNotes(company?.notes ?? "");
  }, [open, company]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const opt = (v: string) => (v === NONE ? null : v);
  const dt = opt(dealType) as DealType | null;

  const isLost = stage === "perso";
  const needsNextStep = status === "lead" && !isLost;
  const canSave =
    !!name.trim() && (!needsNextStep || !!nextStep.trim()) && (!isLost || !!lostReason.trim());

  const handleSave = async () => {
    if (!canSave) return;
    try {
      const companyId = await save.mutateAsync({
        id: savedCompanyId ?? company?.id,
        values: {
          name: name.trim(),
          legal_name: legalName.trim() || null,
          status: status as Company["status"],
          stage: stage as Company["stage"],
          temperature: opt(temperature),
          source_channel: opt(sourceChannel),
          owner_id: opt(ownerId),
          sector: sector.trim() || null,
          website: website.trim() || null,
          logo_url: logoUrl.trim() || null,
          app_name: appName.trim() || null,
          app_store_url: appStoreUrl.trim() || null,
          play_store_url: playStoreUrl.trim() || null,
          country: country.trim() || null,
          growth_stage: opt(growthStage),
          deal_type: dt,
          deal_fixed: dealNeedsFixed(dt) ? num(dealFixed) : null,
          deal_cpm: dealNeedsCpm(dt) ? num(dealCpm) : null,
          deal_estimated_views: dealNeedsCpm(dt) ? num(dealViews) : null,
          deal_performance_pct: dealNeedsPerformance(dt) ? num(dealPct) : null,
          deal_performance_note: dealNeedsPerformance(dt) ? dealPctNote.trim() || null : null,
          estimated_monthly_value: num(monthlyValue),
          next_step: isLost ? null : nextStep.trim() || null,
          next_step_date: isLost ? null : nextStepDate || null,
          lost_reason: isLost ? lostReason.trim() : company?.lost_reason ?? null,
          notes: notes.trim() || null,
        } as Partial<Company>,
      });
      setSavedCompanyId(companyId);
      if (logoFile) {
        await uploadLogo.mutateAsync({ companyId, file: logoFile, previousLogoUrl: company?.logo_url });
      }
      onOpenChange(false);
    } catch {
      // Le mutation mostrano già il messaggio di errore appropriato.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? t("Modifica azienda") : t("Nuova azienda")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("Nome azienda *")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Es. Unflat")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Ragione sociale")}</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder={t("Opzionale")} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Logo azienda")}</Label>
            <div className="flex flex-wrap items-center gap-3">
              <CompanyLogo name={name || t("Azienda")} logoUrl={logoPreview ?? logoUrl} className="h-14 w-14" />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (logoPreview) URL.revokeObjectURL(logoPreview);
                  setLogoFile(file);
                  setLogoPreview(URL.createObjectURL(file));
                  event.target.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                {logoUrl || logoFile ? <Upload className="mr-2 h-4 w-4" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {logoUrl || logoFile ? t("Sostituisci logo") : t("Carica logo")}
              </Button>
              <span className="text-xs text-muted-foreground">{t("PNG, JPG, WEBP o SVG, massimo 5 MB")}</span>
              <div className="hidden">
              <Input
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder={t("Incolla il link del logo")}
              />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("Stato")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(STATUS_LABEL[s])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Stadio")}</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{t(STAGE_LABEL[s])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Temperatura")}</Label>
              <Select value={temperature} onValueChange={setTemperature}>
                <SelectTrigger><SelectValue placeholder={t("Non indicata")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("Non indicata")}</SelectItem>
                  {TEMPERATURES.map((temp) => (
                    <SelectItem key={temp} value={temp}>{t(TEMPERATURE_LABEL[temp])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("Canale di arrivo")}</Label>
              <Select value={sourceChannel} onValueChange={setSourceChannel}>
                <SelectTrigger><SelectValue placeholder={t("Non indicato")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("Non indicato")}</SelectItem>
                  {SOURCE_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Responsabile")}</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder={t("Nessuno")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("Nessuno")}</SelectItem>
                  {staff.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name ?? t("Senza nome")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Settore")}</Label>
              <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder={t("Es. Fintech")} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("Nome dell'app")}</Label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Paese")}</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("Es. Italia")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("Link App Store")}</Label>
                <Input value={appStoreUrl} onChange={(e) => setAppStoreUrl(e.target.value)} placeholder="https://" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Link Play Store")}</Label>
                <Input value={playStoreUrl} onChange={(e) => setPlayStoreUrl(e.target.value)} placeholder="https://" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("Sito web")}</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Fase di crescita")}</Label>
                <Select value={growthStage} onValueChange={setGrowthStage}>
                  <SelectTrigger><SelectValue placeholder={t("Non indicata")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("Non indicata")}</SelectItem>
                    {GROWTH_STAGES.map((g) => (
                      <SelectItem key={g} value={g}>{t(GROWTH_STAGE_LABEL[g])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="grid gap-1.5">
              <Label>{t("Tipo di accordo")}</Label>
              <Select value={dealType} onValueChange={setDealType}>
                <SelectTrigger><SelectValue placeholder={t("Da definire")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("Da definire")}</SelectItem>
                  {DEAL_TYPES.map((dtype) => (
                    <SelectItem key={dtype} value={dtype}>{t(DEAL_TYPE_LABEL[dtype])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dealNeedsFixed(dt) && (
              <div className="grid gap-1.5">
                <Label>{t("Fisso mensile (€)")}</Label>
                <Input type="number" step="0.01" value={dealFixed} onChange={(e) => setDealFixed(e.target.value)} />
              </div>
            )}

            {dealNeedsCpm(dt) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("CPM (€)")}</Label>
                  <Input type="number" step="0.01" value={dealCpm} onChange={(e) => setDealCpm(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("Views stimate al mese")}</Label>
                  <Input type="number" step="1" value={dealViews} onChange={(e) => setDealViews(e.target.value)} />
                </div>
              </div>
            )}

            {dealNeedsPerformance(dt) && (
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("Percentuale performance (%)")}</Label>
                  <Input type="number" step="0.01" value={dealPct} onChange={(e) => setDealPct(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("Cosa conta come conversione")}</Label>
                  <Textarea rows={2} value={dealPctNote} onChange={(e) => setDealPctNote(e.target.value)}
                    placeholder={t("Es. registrazione completata con documento verificato")} />
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>{t("Valore mensile stimato (€)")}</Label>
              <Input type="number" step="0.01" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {t("Inserito a mano: performance e CPM non si possono calcolare in anticipo.")}
              </p>
            </div>
          </div>

          {isLost ? (
            <div className="grid gap-1.5">
              <Label>{t("Motivo della perdita *")}</Label>
              <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)}
                placeholder={t("Es. budget non disponibile")} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("Prossimo passo {mark}", { mark: needsNextStep ? "*" : "" })}</Label>
                <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder={t("Es. inviare proposta")} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Data prossimo passo")}</Label>
                <Input type="date" value={nextStepDate} onChange={(e) => setNextStepDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>{t("Note")}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Annulla")}</Button>
          <Button onClick={handleSave} disabled={!canSave || save.isPending || uploadLogo.isPending}>
            {save.isPending || uploadLogo.isPending ? t("Salvataggio...") : t("Salva")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

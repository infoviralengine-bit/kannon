import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  DEAL_TYPE_LABEL, GROWTH_STAGE_LABEL, TEMPERATURE_LABEL, formatDateIt,
  type DealType, type GrowthStage, type Temperature,
} from "@/lib/companies";
import {
  useDeleteContact, useSaveContact, type Company, type CompanyContact,
} from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

type Props = {
  company: Company;
  contacts: CompanyContact[];
  ownerName: string;
};

export function OverviewTab({ company, contacts, ownerName }: Props) {
  const { t } = useI18n();
  const saveContact = useSaveContact();
  const deleteContact = useDeleteContact();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyContact | null>(null);
  const [form, setForm] = useState({ full_name: "", role_title: "", email: "", phone: "" });

  const openForm = (c?: CompanyContact) => {
    setEditing(c ?? null);
    setForm({
      full_name: c?.full_name ?? "",
      role_title: c?.role_title ?? "",
      email: c?.email ?? "",
      phone: c?.phone ?? "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.full_name.trim()) return;
    saveContact.mutate(
      {
        id: editing?.id,
        values: {
          company_id: company.id,
          full_name: form.full_name.trim(),
          role_title: form.role_title.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("Azienda")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label={t("Ragione sociale")} value={company.legal_name} />
          <Row label={t("App")} value={company.app_name} />
          <Row label={t("Settore")} value={company.sector} />
          <Row label={t("Paese")} value={company.country} />
          <Row label={t("Fase di crescita")} value={
            company.growth_stage ? GROWTH_STAGE_LABEL[company.growth_stage as GrowthStage] : null
          } />
          <Row label={t("Canale di arrivo")} value={company.source_channel} />
          <Row label={t("Responsabile")} value={ownerName} />
          <Row label={t("Temperatura")} value={
            company.temperature && company.status !== "cliente" ? TEMPERATURE_LABEL[company.temperature as Temperature] : null
          } />
          <Row label={t("Ultimo contatto")} value={
            company.last_contact_at ? formatDateIt(company.last_contact_at) : null
          } />
          <div className="flex flex-wrap gap-2 pt-2">
            {company.website && <LinkChip href={company.website} label={t("Sito")} />}
            {company.app_store_url && <LinkChip href={company.app_store_url} label={t("App Store")} />}
            {company.play_store_url && <LinkChip href={company.play_store_url} label={t("Play Store")} />}
          </div>
          {company.notes && (
            <p className="whitespace-pre-wrap pt-2 text-muted-foreground">{company.notes}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Accordo")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label={t("Tipo")} value={company.deal_type ? DEAL_TYPE_LABEL[company.deal_type as DealType] : null} />
          {company.deal_fixed != null && <Row label={t("Fisso mensile")} value={formatCurrency(Number(company.deal_fixed))} />}
          {company.deal_cpm != null && <Row label={t("CPM")} value={formatCurrency(Number(company.deal_cpm))} />}
          {company.deal_estimated_views != null && (
            <Row label={t("Views stimate")} value={Number(company.deal_estimated_views).toLocaleString("it-IT")} />
          )}
          {company.deal_performance_pct != null && (
            <Row label={t("Performance")} value={`${company.deal_performance_pct}%`} />
          )}
          {company.deal_performance_note && (
            <Row label={t("Conversione")} value={company.deal_performance_note} />
          )}
          <Row label={t("Valore mensile stimato")} value={
            company.estimated_monthly_value != null
              ? formatCurrency(Number(company.estimated_monthly_value)) : null
          } />
          {company.lost_reason && (
            <Row label={t("Motivo della perdita")} value={company.lost_reason} />
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("Contatti")}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => openForm()}>
            <Plus className="mr-1 h-4 w-4" /> {t("Nuovo contatto")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">
                  {c.full_name}
                  {c.is_primary && <Badge variant="outline" className="ml-2 text-[10px]">{t("Principale")}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.role_title, c.email, c.phone].filter(Boolean).join(" · ") || t("Nessun recapito")}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openForm(c)}>{t("Modifica")}</Button>
                <Button size="sm" variant="ghost"
                  onClick={() => deleteContact.mutate({ id: c.id, companyId: company.id })}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          {!contacts.length && <p className="text-sm text-muted-foreground">{t("Nessun contatto.")}</p>}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? t("Modifica contatto") : t("Nuovo contatto")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t("Nome *")}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Ruolo")}</Label>
              <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("Email")}</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Telefono")}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("Annulla")}</Button>
            <Button onClick={submit} disabled={!form.full_name.trim() || saveContact.isPending}>{t("Salva")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary/50">
      {label} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

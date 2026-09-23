/**
 * Clienti e Pipeline B2B: costanti, etichette e helper condivisi.
 */

export const COMPANY_STATUSES = ["lead", "cliente", "ex_cliente"] as const;
export type CompanyStatus = typeof COMPANY_STATUSES[number];

export const COMPANY_STAGES = [
  "nuova",
  "contattata",
  "ha_risposto",
  "call_fissata",
  "call_fatta",
  "proposta_inviata",
  "trattativa",
  "vinto",
  "perso",
] as const;
export type CompanyStage = typeof COMPANY_STAGES[number];

/** Stadi mostrati come colonne nel kanban (senza perso). */
export const PIPELINE_STAGES: CompanyStage[] = [
  "nuova",
  "contattata",
  "ha_risposto",
  "call_fissata",
  "call_fatta",
  "proposta_inviata",
  "trattativa",
  "vinto",
];

export const STAGE_LABEL: Record<CompanyStage, string> = {
  nuova: "Nuova",
  contattata: "Contattata",
  ha_risposto: "Ha risposto",
  call_fissata: "Call fissata",
  call_fatta: "Call fatta",
  proposta_inviata: "Proposta inviata",
  trattativa: "Trattativa",
  vinto: "Vinta",
  perso: "Persa",
};

export const STATUS_LABEL: Record<CompanyStatus, string> = {
  lead: "Lead",
  cliente: "Cliente",
  ex_cliente: "Ex cliente",
};

export const STATUS_BADGE: Record<CompanyStatus, string> = {
  lead: "bg-warning/20 text-warning border-warning/30",
  cliente: "bg-success/20 text-success border-success/30",
  ex_cliente: "bg-muted text-muted-foreground border-border",
};

export const TEMPERATURES = ["caldo", "tiepido", "freddo"] as const;
export type Temperature = typeof TEMPERATURES[number];

export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  caldo: "Caldo",
  tiepido: "Tiepido",
  freddo: "Freddo",
};

export const TEMPERATURE_BADGE: Record<Temperature, string> = {
  caldo: "bg-destructive/20 text-destructive border-destructive/30",
  tiepido: "bg-warning/20 text-warning border-warning/30",
  freddo: "bg-info/15 text-info border-info/30",
};

export const DEAL_TYPES = [
  "fisso_cpm",
  "fisso_performance",
  "solo_cpm",
  "solo_fisso",
] as const;
export type DealType = typeof DEAL_TYPES[number];

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  fisso_cpm: "Fisso + CPM",
  fisso_performance: "Fisso + performance",
  solo_cpm: "Solo CPM",
  solo_fisso: "Solo fisso",
};

export function dealNeedsFixed(t: DealType | null | undefined) {
  return t === "fisso_cpm" || t === "fisso_performance" || t === "solo_fisso";
}
export function dealNeedsCpm(t: DealType | null | undefined) {
  return t === "fisso_cpm" || t === "solo_cpm";
}
export function dealNeedsPerformance(t: DealType | null | undefined) {
  return t === "fisso_performance";
}

export const GROWTH_STAGES = ["pre_lancio", "early", "scaling", "consolidata"] as const;
export type GrowthStage = typeof GROWTH_STAGES[number];

export const GROWTH_STAGE_LABEL: Record<GrowthStage, string> = {
  pre_lancio: "Pre lancio",
  early: "Primi utenti",
  scaling: "In crescita",
  consolidata: "Consolidata",
};

export const SOURCE_CHANNELS = [
  "LinkedIn",
  "Email a freddo",
  "Instagram",
  "Referral",
  "Inbound",
  "Evento",
  "Altro",
] as const;

export const ACTIVITY_TYPES = [
  "chiamata",
  "email",
  "incontro",
  "messaggio",
  "linkedin",
  "whatsapp",
  "nota",
  "cambio_stadio",
  "sistema",
] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  chiamata: "Chiamata",
  email: "Email",
  incontro: "Incontro",
  messaggio: "Messaggio",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  nota: "Nota",
  cambio_stadio: "Cambio stadio",
  sistema: "Sistema",
};

/** Tipi di attività che l'utente può registrare a mano. */
export const MANUAL_ACTIVITY_TYPES: ActivityType[] = [
  "chiamata",
  "email",
  "incontro",
  "messaggio",
  "linkedin",
  "whatsapp",
  "nota",
];

/** Attività per cui ha senso indicare se è partita da noi o dal cliente. */
export const DIRECTIONAL_ACTIVITY_TYPES: ActivityType[] = [
  "email",
  "messaggio",
  "linkedin",
  "whatsapp",
  "chiamata",
];

export const ACTIVITY_DIRECTIONS = ["inviata", "ricevuta"] as const;
export type ActivityDirection = typeof ACTIVITY_DIRECTIONS[number];

export const ACTIVITY_DIRECTION_LABEL: Record<ActivityDirection, string> = {
  inviata: "Inviata da noi",
  ricevuta: "Ricevuta",
};

export const TASK_TYPES = ["chiamata", "email", "follow_up", "documento", "altro"] as const;
export type TaskType = typeof TASK_TYPES[number];

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  chiamata: "Chiamata",
  email: "Email",
  follow_up: "Follow up",
  documento: "Documento",
  altro: "Altro",
};

export const DOC_DIRECTIONS = ["da_inviare", "da_ricevere"] as const;
export type DocDirection = typeof DOC_DIRECTIONS[number];

export const DOC_DIRECTION_LABEL: Record<DocDirection, string> = {
  da_inviare: "Inviati",
  da_ricevere: "Ricevuti",
};

export const DOC_TYPES = [
  "contratto",
  "fattura",
  "nda",
  "asset",
  "accessi",
  "brief",
  "report",
  "altro",
] as const;
export type DocType = typeof DOC_TYPES[number];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  contratto: "Contratto",
  fattura: "Fattura",
  nda: "NDA",
  asset: "Asset del brand",
  accessi: "Accessi",
  brief: "Brief",
  report: "Report",
  altro: "Altro",
};

export const DOC_STATUSES = ["in_attesa", "fatto"] as const;
export type DocStatus = typeof DOC_STATUSES[number];

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  in_attesa: "In attesa",
  fatto: "Completato",
};

export function formatDateIt(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("it-IT");
}

export function formatDateTimeIt(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** true se la data è scaduta rispetto a oggi (confronto per giorno). */
export function isOverdue(date: string | null | undefined) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date) < today;
}

export function isToday(date: string | null | undefined) {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/** true se la data cade entro i prossimi 7 giorni (oggi incluso). */
export function isThisWeek(date: string | null | undefined) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 7);
  const d = new Date(date);
  return d >= today && d < limit;
}

/** Giorni passati da una data, null se assente. */
export function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const diff = Date.now() - new Date(value).getTime();
  return Math.floor(diff / 86_400_000);
}

/** Data ISO (YYYY-MM-DD) spostata di n giorni da oggi. */
export function isoDateIn(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

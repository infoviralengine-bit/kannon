export type Slot = string | null;
export type AllocationRow = { creator_id: string; slots: Slot[]; paused: boolean };
export type AllocationCampaign = { id: string; name: string; client_name: string; company_id?: string | null; logo_url?: string | null; start_date: string; end_date: string | null; status: string; min_monthly_videos: number | null; monthly_spend_cap: number | null; priority: number; is_residual: boolean };

const DAY = 86400000;
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`);
export const iso = (value: Date) => value.toISOString().slice(0, 10);
export function monday(value: Date) {
  const d = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return iso(d);
}
export function shiftWeek(week: string, weeks: number) { return iso(new Date(date(week).getTime() + weeks * 7 * DAY)); }
export function activeDays(c: AllocationCampaign, week: string) {
  const start = date(week).getTime();
  let days = 0;
  for (let i = 0; i < 6; i++) {
    const day = iso(new Date(start + i * DAY));
    if (day >= c.start_date && (!c.end_date || day <= c.end_date) && c.status === 'active') days++;
  }
  return days;
}
export function paint(slots: Slot[], index: number, campaign: string): Slot[] {
  if (index < 0 || index >= slots.length) return slots;
  const next = [...slots];
  const original = next[index];
  if (original && original !== campaign) { next[index] = campaign; return next; }
  if (original === campaign && index > 0 && next[index - 1] === campaign) {
    let start = index;
    while (start > 0 && next[start - 1] === campaign) start--;
    for (let i = index; i < next.length && next[i] === campaign; i++) next[i] = null;
    return next;
  }
  let start = index;
  while (start > 0 && next[start - 1] === null) start--;
  if (original === campaign && start === index) {
    let end = index;
    while (end < next.length && next[end] === campaign) next[end++] = null;
    return next;
  }
  let end = index + 1;
  if (original === campaign) while (end < next.length && next[end] === campaign) next[end++] = null;
  for (let i = start; i <= index; i++) next[i] = campaign;
  return next;
}
export function effectiveSlots(row: AllocationRow, residualId: string | null, auto: boolean): Slot[] {
  if (row.paused) return [];
  return row.slots.map(s => s ?? (auto ? residualId : null));
}
export function campTotals(rows: AllocationRow[], campaign: AllocationCampaign, week: string, residualId: string | null, auto: boolean) {
  const days = activeDays(campaign, week);
  const participating = rows.filter(r => effectiveSlots(r, residualId, auto).includes(campaign.id));
  const slots = participating.reduce((n, r) => n + effectiveSlots(r, residualId, auto).filter(s => s === campaign.id).length, 0);
  const target = campaign.is_residual ? null : Math.round((campaign.min_monthly_videos ?? 0) * days / 26);
  return { days, slots, videos: slots * days, target, accounts: participating.length };
}
export function normalizeSlots(raw: unknown, capacity: number): Slot[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: capacity }, (_, i) => typeof arr[i] === 'string' ? arr[i] as string : null);
}
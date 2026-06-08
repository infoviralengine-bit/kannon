export type PaymentTerms =
  | {
      type: "standard_lagged";
      fixedDueDay: number;
      cpmLagMonths: number;
      finalCpmDelayDays: number;
    }
  | {
      type: "tot_split";
      firstHalfDay: number;
      secondHalfDay: number;
      cpmPayoutDelayDays: number;
    };

export const DEFAULT_STANDARD: PaymentTerms = {
  type: "standard_lagged",
  fixedDueDay: 1,
  cpmLagMonths: 1,
  finalCpmDelayDays: 30,
};

export const DEFAULT_TOT_SPLIT: PaymentTerms = {
  type: "tot_split",
  firstHalfDay: 1,
  secondHalfDay: 28,
  cpmPayoutDelayDays: 30,
};

export function paymentTermsLabel(t: PaymentTerms): string {
  if (t.type === "standard_lagged") {
    return `Standard mensile (fisso giorno ${t.fixedDueDay}, CPM laggato ${t.cpmLagMonths} mese)`;
  }
  return `ToT split (fisso 50% giorno ${t.firstHalfDay}, 50% giorno ${t.secondHalfDay}, CPM finale +${t.cpmPayoutDelayDays}g)`;
}

export function parsePaymentTerms(json: unknown): PaymentTerms {
  if (!json || typeof json !== "object") return DEFAULT_STANDARD;
  const t = (json as any).type;
  if (t === "tot_split") return { ...DEFAULT_TOT_SPLIT, ...(json as any) };
  return { ...DEFAULT_STANDARD, ...(json as any) };
}

export type PaymentKind = "standard" | "tot_fixed_first" | "tot_fixed_second" | "tot_final_cpm";

export function paymentKindLabel(k: PaymentKind): string {
  switch (k) {
    case "tot_fixed_first": return "1ª metà fisso";
    case "tot_fixed_second": return "2ª metà fisso";
    case "tot_final_cpm": return "CPM finale";
    default: return "";
  }
}
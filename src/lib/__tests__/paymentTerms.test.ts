import { describe, expect, it } from "vitest";
import {
  parsePaymentTerms,
  DEFAULT_STANDARD,
  DEFAULT_TOT_SPLIT,
} from "../paymentTerms";

describe("parsePaymentTerms", () => {
  it("returns DEFAULT_STANDARD for null/undefined", () => {
    expect(parsePaymentTerms(null)).toEqual(DEFAULT_STANDARD);
    expect(parsePaymentTerms(undefined)).toEqual(DEFAULT_STANDARD);
  });
  it("returns DEFAULT_STANDARD for non-object input", () => {
    expect(parsePaymentTerms("foo")).toEqual(DEFAULT_STANDARD);
    expect(parsePaymentTerms(42)).toEqual(DEFAULT_STANDARD);
  });
  it("returns DEFAULT_TOT_SPLIT defaults when type=tot_split with no other fields", () => {
    expect(parsePaymentTerms({ type: "tot_split" })).toEqual(DEFAULT_TOT_SPLIT);
  });
  it("merges custom fields into tot_split", () => {
    const out = parsePaymentTerms({
      type: "tot_split",
      firstHalfDay: 5,
      cpmPayoutDelayDays: 45,
    });
    expect(out).toEqual({
      ...DEFAULT_TOT_SPLIT,
      firstHalfDay: 5,
      cpmPayoutDelayDays: 45,
    });
  });
  it("merges custom fields into standard_lagged", () => {
    const out = parsePaymentTerms({
      type: "standard_lagged",
      fixedDueDay: 10,
      cpmLagMonths: 2,
    });
    expect(out).toEqual({
      ...DEFAULT_STANDARD,
      fixedDueDay: 10,
      cpmLagMonths: 2,
    });
  });
  it("falls back to standard defaults for unknown type, preserving extra fields", () => {
    const out = parsePaymentTerms({ type: "mystery", fixedDueDay: 7 });
    // Non-tot_split inputs are merged on top of DEFAULT_STANDARD.
    expect((out as any).fixedDueDay).toBe(7);
    expect((out as any).cpmLagMonths).toBe((DEFAULT_STANDARD as any).cpmLagMonths);
    expect((out as any).finalCpmDelayDays).toBe((DEFAULT_STANDARD as any).finalCpmDelayDays);
  });
});
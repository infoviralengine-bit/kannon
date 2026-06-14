import { describe, expect, it } from "vitest";
import { getContractPeriod } from "../contractPeriods";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("getContractPeriod - standard (no firstPeriodStart, no overrides)", () => {
  const start = utc(2025, 1, 1);
  it("period 1 = start..start+29", () => {
    const { periodStart, periodEnd } = getContractPeriod(start, 1);
    expect(iso(periodStart)).toBe("2025-01-01");
    expect(iso(periodEnd)).toBe("2025-01-30");
  });
  it("period 2 = +30 days", () => {
    const { periodStart, periodEnd } = getContractPeriod(start, 2);
    expect(iso(periodStart)).toBe("2025-01-31");
    expect(iso(periodEnd)).toBe("2025-03-01");
  });
  it("period 3 = +60 days", () => {
    const { periodStart, periodEnd } = getContractPeriod(start, 3);
    expect(iso(periodStart)).toBe("2025-03-02");
    expect(iso(periodEnd)).toBe("2025-03-31");
  });
});

describe("getContractPeriod - with firstPeriodStart", () => {
  const start = utc(2025, 1, 1);
  const fps = utc(2024, 12, 15);
  it("period 1 = fps..start-1", () => {
    const { periodStart, periodEnd } = getContractPeriod(start, 1, fps);
    expect(iso(periodStart)).toBe("2024-12-15");
    expect(iso(periodEnd)).toBe("2024-12-31");
  });
  it("period 2 anchors at startDate", () => {
    const { periodStart, periodEnd } = getContractPeriod(start, 2, fps);
    expect(iso(periodStart)).toBe("2025-01-01");
    expect(iso(periodEnd)).toBe("2025-01-30");
  });
  it("period 3 follows cadence", () => {
    const { periodStart, periodEnd } = getContractPeriod(start, 3, fps);
    expect(iso(periodStart)).toBe("2025-01-31");
    expect(iso(periodEnd)).toBe("2025-03-01");
  });
});

describe("getContractPeriod - with periodOverrides", () => {
  const start = utc(2025, 1, 1);
  it("end override re-anchors next period", () => {
    const overrides = { "1": { end: "2025-01-15" } };
    const p1 = getContractPeriod(start, 1, null, overrides);
    expect(iso(p1.periodEnd)).toBe("2025-01-15");
    const p2 = getContractPeriod(start, 2, null, overrides);
    expect(iso(p2.periodStart)).toBe("2025-01-16");
    expect(iso(p2.periodEnd)).toBe("2025-02-14");
  });
  it("override on later period only affects that and downstream", () => {
    const overrides = { "2": { end: "2025-02-20" } };
    const p2 = getContractPeriod(start, 2, null, overrides);
    expect(iso(p2.periodEnd)).toBe("2025-02-20");
    const p3 = getContractPeriod(start, 3, null, overrides);
    expect(iso(p3.periodStart)).toBe("2025-02-21");
    expect(iso(p3.periodEnd)).toBe("2025-03-22");
  });
  it("works combined with firstPeriodStart", () => {
    const fps = utc(2024, 12, 15);
    const overrides = { "2": { end: "2025-01-20" } };
    const p2 = getContractPeriod(start, 2, fps, overrides);
    expect(iso(p2.periodStart)).toBe("2025-01-01");
    expect(iso(p2.periodEnd)).toBe("2025-01-20");
    const p3 = getContractPeriod(start, 3, fps, overrides);
    expect(iso(p3.periodStart)).toBe("2025-01-21");
    expect(iso(p3.periodEnd)).toBe("2025-02-19");
  });
});
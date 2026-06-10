/**
 * Rolling 30-day period logic based on contract start dates.
 *
 * When `firstPeriodStart` is provided:
 *   Period 1: firstPeriodStart → startDate - 1 day (exceptional, may be != 30 days)
 *   Period N (N>=2): startDate + (N-2)*30 → startDate + (N-2)*30 + 29
 *
 * When `firstPeriodStart` is NOT provided (standard):
 *   Period 1: startDate → startDate + 29 days (30 days inclusive)
 *   Period N: startDate + (N-1)*30 → startDate + (N-1)*30 + 29
 *
 * `periodOverrides` allows ad-hoc end-date overrides per period number.
 * Shape: { "<periodNumber>": { end: "YYYY-MM-DD" } }
 * When period N is overridden, subsequent periods (N+1, N+2, ...) anchor
 * to the overridden end (start = overriddenEnd + 1 day) and resume the
 * standard 30-day cadence from there.
 */

export type PeriodOverrides = Record<string, { end?: string; start?: string }> | null | undefined;

function toUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUtc(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function parseOverrideDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Get the start and end dates for a given period number (1-indexed).
 * Both dates are inclusive. Uses UTC to avoid timezone issues.
 */
export function getContractPeriod(
  startDate: Date,
  periodNumber: number,
  firstPeriodStart?: Date | null,
  periodOverrides?: PeriodOverrides,
): { periodStart: Date; periodEnd: Date } {
  const base = toUtcDay(startDate);
  const fps = firstPeriodStart ? toUtcDay(firstPeriodStart) : null;
  const overrides = periodOverrides ?? {};
  const hasOverrides = Object.keys(overrides).length > 0;

  // Fast path: no overrides → original formula (preserves exact prior behavior).
  if (!hasOverrides) {
    if (fps && periodNumber === 1) {
      return { periodStart: fps, periodEnd: addDaysUtc(base, -1) };
    }
    if (fps) {
      const periodStart = addDaysUtc(base, (periodNumber - 2) * 30);
      return { periodStart, periodEnd: addDaysUtc(periodStart, 29) };
    }
    const periodStart = addDaysUtc(base, (periodNumber - 1) * 30);
    return { periodStart, periodEnd: addDaysUtc(periodStart, 29) };
  }

  // Iterative walk: applies overrides and re-anchors subsequent periods.
  let curStart: Date;
  let curEnd: Date;
  for (let n = 1; n <= periodNumber; n++) {
    if (n === 1) {
      curStart = fps ?? base;
      curEnd = fps ? addDaysUtc(base, -1) : addDaysUtc(curStart, 29);
    } else {
      curStart = addDaysUtc(curEnd!, 1);
      curEnd = addDaysUtc(curStart, 29);
    }
    const ov = overrides[String(n)];
    if (ov?.start) curStart = parseOverrideDate(ov.start);
    if (ov?.end) curEnd = parseOverrideDate(ov.end);
  }
  return { periodStart: curStart!, periodEnd: curEnd! };
}

/**
 * Determine which period number a given date falls into.
 * Returns 1 if the date is before the start date.
 */
export function getPeriodNumberForDate(
  startDate: Date,
  date: Date,
  firstPeriodStart?: Date | null,
  periodOverrides?: PeriodOverrides,
): number {
  const target = toUtcDay(date).getTime();
  // Walk forward period-by-period until target falls within [start, end].
  // Cap at a safe upper bound (10 years of 30-day periods).
  for (let n = 1; n <= 130; n++) {
    const { periodStart, periodEnd } = getContractPeriod(
      startDate,
      n,
      firstPeriodStart,
      periodOverrides,
    );
    if (target < periodStart.getTime()) return Math.max(1, n - 1 || 1);
    if (target <= periodEnd.getTime()) return n;
  }
  return 130;
}

/**
 * Get the current period number based on today's date.
 */
export function getCurrentPeriodNumber(
  startDate: Date,
  firstPeriodStart?: Date | null,
  periodOverrides?: PeriodOverrides,
): number {
  return getPeriodNumberForDate(startDate, new Date(), firstPeriodStart, periodOverrides);
}

/**
 * Count working days (Mon-Sat, excluding Sundays) in a date range (inclusive).
 */
export function getWorkingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  ));
  const endMs = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  while (current.getTime() <= endMs) {
    if (current.getUTCDay() !== 0) count++; // exclude Sunday
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

/**
 * Check if the creator has earned the fixed for a period.
 */
export function isFixedEarnedInPeriod(
  videoCount: number,
  minPerDay: number,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  if (minPerDay === 0) return true;
  const workingDays = getWorkingDaysInRange(periodStart, periodEnd);
  const target = minPerDay * workingDays;
  return videoCount >= target;
}

/**
 * Get the target video count for a period.
 */
export function getPeriodTarget(
  minPerDay: number,
  periodStart: Date,
  periodEnd: Date,
): number {
  return minPerDay * getWorkingDaysInRange(periodStart, periodEnd);
}

/**
 * Format a period's date range for display.
 */
export function formatPeriodRange(periodStart: Date, periodEnd: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const s = periodStart.toLocaleDateString("it-IT", { ...opts, timeZone: "UTC" });
  const e = periodEnd.toLocaleDateString("it-IT", { ...opts, timeZone: "UTC" });
  const yearEnd = periodEnd.toLocaleDateString("it-IT", { year: "numeric", timeZone: "UTC" }).split("/").pop();
  return `${s} – ${e} ${yearEnd}`;
}

/**
 * Parse a date string (YYYY-MM-DD or ISO) to a UTC Date.
 */
export function parseContractStartDate(dateStr: string): Date {
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

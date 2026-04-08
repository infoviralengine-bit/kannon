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
 */

/**
 * Get the start and end dates for a given period number (1-indexed).
 * Both dates are inclusive. Uses UTC to avoid timezone issues.
 */
export function getContractPeriod(
  startDate: Date,
  periodNumber: number,
  firstPeriodStart?: Date | null,
): { periodStart: Date; periodEnd: Date } {
  const base = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  ));

  if (firstPeriodStart && periodNumber === 1) {
    const fps = new Date(Date.UTC(
      firstPeriodStart.getUTCFullYear(),
      firstPeriodStart.getUTCMonth(),
      firstPeriodStart.getUTCDate(),
    ));
    const periodEnd = new Date(base);
    periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);
    return { periodStart: fps, periodEnd };
  }

  if (firstPeriodStart) {
    // Period N >= 2: offset from startDate by (N-2)*30
    const periodStart = new Date(base);
    periodStart.setUTCDate(periodStart.getUTCDate() + (periodNumber - 2) * 30);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 29);
    return { periodStart, periodEnd };
  }

  // Standard: no firstPeriodStart
  const periodStart = new Date(base);
  periodStart.setUTCDate(periodStart.getUTCDate() + (periodNumber - 1) * 30);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 29);
  return { periodStart, periodEnd };
}

/**
 * Determine which period number a given date falls into.
 * Returns 1 if the date is before the start date.
 */
export function getPeriodNumberForDate(
  startDate: Date,
  date: Date,
  firstPeriodStart?: Date | null,
): number {
  const baseMs = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );
  const dateMs = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  if (firstPeriodStart) {
    const fpsMs = Date.UTC(
      firstPeriodStart.getUTCFullYear(),
      firstPeriodStart.getUTCMonth(),
      firstPeriodStart.getUTCDate(),
    );
    if (dateMs < fpsMs) return 1;
    if (dateMs < baseMs) return 1; // still in the exceptional period 1
    // From startDate onwards: period = floor(diff/30) + 2
    const diffDays = Math.floor((dateMs - baseMs) / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 30) + 2;
  }

  const diffDays = Math.floor((dateMs - baseMs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 30) + 1;
}

/**
 * Get the current period number based on today's date.
 */
export function getCurrentPeriodNumber(
  startDate: Date,
  firstPeriodStart?: Date | null,
): number {
  return getPeriodNumberForDate(startDate, new Date(), firstPeriodStart);
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

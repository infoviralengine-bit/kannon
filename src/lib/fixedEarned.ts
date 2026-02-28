/**
 * Monthly fixed earning logic.
 * Fixed is earned if creator reaches total monthly video target:
 *   total_required = min_videos_per_day × working_days_in_month (Mon-Sat)
 */

/**
 * Count working days (Mon-Sat, excluding Sundays) in a given month.
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0) count++; // exclude Sunday
  }
  return count;
}

/**
 * Count working days elapsed so far (up to yesterday) in the given month.
 * If the month is in the past, returns all working days.
 */
export function getWorkingDaysElapsed(year: number, month: number): number {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const lastDay = isCurrentMonth
    ? now.getDate() - 1
    : new Date(year, month + 1, 0).getDate();

  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0) count++;
  }
  return count;
}

/**
 * Count remaining working days (from today to end of month, inclusive).
 */
export function getWorkingDaysRemaining(year: number, month: number): number {
  const total = getWorkingDaysInMonth(year, month);
  const elapsed = getWorkingDaysElapsed(year, month);
  // Include today as remaining
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayIsWorkDay = isCurrentMonth && now.getDay() !== 0;
  return total - elapsed - (todayIsWorkDay ? 0 : 0);
  // Actually: remaining = total - elapsed (today not counted in elapsed since elapsed is up to yesterday)
}

/**
 * Check if the creator has earned the monthly fixed based on total video count.
 * @param monthVideoCount Total videos published in the month
 * @param minPerDay min_videos_per_day
 * @param year
 * @param month 0-indexed
 * @returns true if monthVideoCount >= minPerDay * workingDaysInMonth
 */
export function isFixedEarnedMonthly(
  monthVideoCount: number,
  minPerDay: number,
  year: number,
  month: number,
): boolean {
  const totalRequired = minPerDay * getWorkingDaysInMonth(year, month);
  return monthVideoCount >= totalRequired;
}

/**
 * Get the total required videos for the month.
 */
export function getMonthlyTarget(minPerDay: number, year: number, month: number): number {
  return minPerDay * getWorkingDaysInMonth(year, month);
}

export type AlertLevel = "green" | "yellow" | "red";

/**
 * Calculate the alert level for a creator based on projection.
 * @param videosSoFar Videos published so far in the month
 * @param minPerDay min_videos_per_day
 * @param year
 * @param month 0-indexed
 */
export function getCreatorAlertLevel(
  videosSoFar: number,
  minPerDay: number,
  year: number,
  month: number,
): AlertLevel {
  const totalRequired = getMonthlyTarget(minPerDay, year, month);
  if (videosSoFar >= totalRequired) return "green";

  const remaining = totalRequired - videosSoFar;
  const workingDaysLeft = getWorkingDaysInMonth(year, month) - getWorkingDaysElapsed(year, month);

  if (workingDaysLeft <= 0) return "red"; // month over and not reached

  const avgNeeded = remaining / workingDaysLeft;
  if (avgNeeded > minPerDay * 1.5) return "red";
  if (avgNeeded > minPerDay) return "yellow";
  return "green";
}

/**
 * Get projection data for UI display.
 */
export function getProgressData(
  videosSoFar: number,
  minPerDay: number,
  year: number,
  month: number,
) {
  const totalRequired = getMonthlyTarget(minPerDay, year, month);
  const workingDaysElapsed = getWorkingDaysElapsed(year, month);
  const workingDaysTotal = getWorkingDaysInMonth(year, month);
  const workingDaysLeft = workingDaysTotal - workingDaysElapsed;

  const avgCurrent = workingDaysElapsed > 0 ? videosSoFar / workingDaysElapsed : 0;
  const avgNeeded = workingDaysLeft > 0 ? (totalRequired - videosSoFar) / workingDaysLeft : 0;
  const alertLevel = getCreatorAlertLevel(videosSoFar, minPerDay, year, month);
  const percent = totalRequired > 0 ? Math.min(100, Math.round((videosSoFar / totalRequired) * 100)) : 0;

  return {
    videosSoFar,
    totalRequired,
    workingDaysElapsed,
    workingDaysTotal,
    workingDaysLeft,
    avgCurrent,
    avgNeeded,
    alertLevel,
    percent,
  };
}

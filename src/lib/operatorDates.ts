const DAY = 86_400_000;

/** UTC ISO date (YYYY-MM-DD) for today minus n days. */
export function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - n * DAY).toISOString().slice(0, 10);
}

export function todayIso(): string {
  return isoDaysAgo(0);
}

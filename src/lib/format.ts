/**
 * Format a number with Italian thousands separator,
 * compacting to k / M for large values.
 */
export function formatViews(n: number): string {
  if (n == null || isNaN(n as any)) return "0";
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(v) >= 10_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toLocaleString("it-IT");
}

/**
 * Format a monetary value in Italian style: €1.234,56
 */
export function formatCurrency(n: number): string {
  return n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

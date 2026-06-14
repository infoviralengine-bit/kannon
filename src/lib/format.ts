/**
 * Format a number with Italian thousands separator (dot)
 */
export function formatViews(n: number): string {
  return n.toLocaleString("it-IT");
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

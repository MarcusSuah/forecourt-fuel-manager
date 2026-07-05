/**
 * Fuel unit conversions and formatting.
 * Single source of truth — do not inline 3.78541 anywhere else.
 */

export const USG_TO_LITERS = 3.78541 as const;

export const usgToLiters = (usg: number): number => usg * USG_TO_LITERS;
export const litersToUsg = (liters: number): number => liters / USG_TO_LITERS;

/** Format a USG value for display: "1,234.56 USG". */
export function formatUsg(usg: number | null | undefined, digits = 2): string {
  if (usg == null || Number.isNaN(usg)) return "—";
  return `${usg.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} USG`;
}

/** Format a liter value for display: "1,234.56 L". */
export function formatLiters(liters: number | null | undefined, digits = 2): string {
  if (liters == null || Number.isNaN(liters)) return "—";
  return `${liters.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} L`;
}

/** Format currency in the given code (default USD). */
export function formatCurrency(
  amount: number | null | undefined,
  currency: "USD" | "LRD" = "USD",
  digits = 2,
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const symbol = currency === "USD" ? "$" : "L$";
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
import { format, startOfWeek, subDays, subWeeks, subMonths, subYears, startOfMonth, startOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, parseISO } from "date-fns";

export type Granularity = "day" | "week" | "month" | "year";

/** Range covered by each granularity (ending today). */
export function rangeFor(g: Granularity, today = new Date()): { from: Date; to: Date } {
  switch (g) {
    case "day": return { from: subDays(today, 29), to: today };
    case "week": return { from: startOfWeek(subWeeks(today, 11), { weekStartsOn: 1 }), to: today };
    case "month": return { from: startOfMonth(subMonths(today, 11)), to: today };
    case "year": return { from: startOfYear(subYears(today, 4)), to: today };
  }
}

/** Bucket key for an ISO date (yyyy-MM-dd). */
export function bucketKey(g: Granularity, iso: string): string {
  const d = parseISO(iso);
  switch (g) {
    case "day": return format(d, "yyyy-MM-dd");
    case "week": return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "month": return format(d, "yyyy-MM");
    case "year": return format(d, "yyyy");
  }
}

export function bucketLabel(g: Granularity, key: string): string {
  switch (g) {
    case "day": return format(parseISO(key), "MMM d");
    case "week": return `Wk ${format(parseISO(key), "MMM d")}`;
    case "month": return format(parseISO(`${key}-01`), "MMM yy");
    case "year": return key;
  }
}

/** All bucket keys in order for the granularity's range. */
export function allBuckets(g: Granularity, today = new Date()): string[] {
  const { from, to } = rangeFor(g, today);
  switch (g) {
    case "day": return eachDayOfInterval({ start: from, end: to }).map((d) => format(d, "yyyy-MM-dd"));
    case "week": return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((d) => format(d, "yyyy-MM-dd"));
    case "month": return eachMonthOfInterval({ start: from, end: to }).map((d) => format(d, "yyyy-MM"));
    case "year": return eachYearOfInterval({ start: from, end: to }).map((d) => format(d, "yyyy"));
  }
}

/**
 * Tank sales per tank-day = first dip − last dip + deliveries that day.
 * Requires at least two dips on the day; otherwise 0.
 */
export function tankDaySales(dipsInOrder: number[], deliveries: number): number {
  if (dipsInOrder.length < 2) return 0;
  return dipsInOrder[0] - dipsInOrder[dipsInOrder.length - 1] + deliveries;
}

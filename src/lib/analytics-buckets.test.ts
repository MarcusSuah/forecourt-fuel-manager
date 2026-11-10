import { describe, it, expect } from "vitest";
import { allBuckets, bucketKey, tankDaySales } from "./analytics-buckets";

describe("analytics buckets", () => {
  const today = new Date(2026, 10, 10);
  it("day view covers 30 days", () => expect(allBuckets("day", today)).toHaveLength(30));
  it("week view covers 12 weeks", () => expect(allBuckets("week", today)).toHaveLength(12));
  it("month view covers 12 months", () => expect(allBuckets("month", today)).toHaveLength(12));
  it("year view covers 5 years", () => expect(allBuckets("year", today)).toEqual(["2022", "2023", "2024", "2025", "2026"]));
  it("weeks start on Monday", () => expect(bucketKey("week", "2026-11-15")).toBe("2026-11-09"));
  it("tank sales = opening − closing + deliveries", () => expect(tankDaySales([5000, 4200, 3000], 1000)).toBe(3000));
  it("single dip gives no sales", () => expect(tankDaySales([5000], 1000)).toBe(0));
});

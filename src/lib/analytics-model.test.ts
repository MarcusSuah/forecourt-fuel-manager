import { describe, it, expect } from "vitest";
import { buildSegments, stockGaps, pumpEfficiency } from "./analytics-model";

const dips = [
  { tankId: "T", date: "2026-11-01", shiftKey: "N", level: 5000, order: 1 },
  { tankId: "T", date: "2026-11-02", shiftKey: "M", level: 7500, order: 2 },
  { tankId: "T", date: "2026-11-02", shiftKey: "A", level: 7000, order: 3 },
];
const deliveries = [{ tankId: "T", date: "2026-11-02", qty: 3000 }];
const meters = [
  { pumpId: "P1", date: "2026-11-02", shiftKey: "M", usg: 480 },
  { pumpId: "P1", date: "2026-11-02", shiftKey: "A", usg: 500 },
  { pumpId: "P2", date: "2026-11-02", shiftKey: "A", usg: 100 },
];
const map = { P1: ["T"], P2: ["T", "X"] };

describe("analytics model", () => {
  const seg = buildSegments(dips, deliveries, meters, map);
  it("tank sales = opening − closing + deliveries", () => expect(seg[0].tankSales).toBe(500));
  it("variance = tank sales − meter sales", () => expect(seg[0].variance).toBe(20));
  it("pump feeding two tanks counts half per tank", () => expect(seg[1].meterSales).toBe(550));
  it("deliveries are only counted once per day", () => expect(seg[1].deliveries).toBe(0));
  it("stock gap sums variance over the period", () => expect(stockGaps(seg)[0].cumulativeGap).toBe(-30));
  it("busiest pump is 100% efficient", () => {
    const e = pumpEfficiency(meters);
    expect(e[0].pumpId).toBe("P1");
    expect(e[0].utilisationPct).toBe(100);
    expect(e[1].utilisationPct).toBeCloseTo((100 / 490) * 100);
  });
});

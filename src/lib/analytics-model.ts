/**
 * Independent stock analytics model.
 * Works only from raw dips, meter readings and deliveries — never from
 * stored variance/level columns — so results can be cross-checked.
 *
 * Each dip is the closing level of its shift; the previous dip of the same
 * tank is that shift's opening level (carry-over).
 */
export interface Dip { tankId: string; date: string; shiftKey: string; level: number; order: number }
export interface Delivery { tankId: string; date: string; qty: number }
export interface MeterRow { pumpId: string; date: string; shiftKey: string; usg: number }

export interface Segment {
  tankId: string; date: string; shiftKey: string;
  opening: number; closing: number; deliveries: number;
  tankSales: number; meterSales: number; variance: number;
}

/** Build shift segments per tank and reconcile against assigned pumps' meter sales. */
export function buildSegments(dips: Dip[], deliveries: Delivery[], meters: MeterRow[], pumpTanks: Record<string, string[]>): Segment[] {
  // Meter sales per tank+date+shift (pumps feeding several tanks split equally)
  const meterKey = (t: string, d: string, s: string) => `${t}|${d}|${s}`;
  const meterByTank: Record<string, number> = {};
  meters.forEach((m) => {
    const tanks = pumpTanks[m.pumpId] ?? [];
    tanks.forEach((t) => {
      const k = meterKey(t, m.date, m.shiftKey);
      meterByTank[k] = (meterByTank[k] ?? 0) + m.usg / tanks.length;
    });
  });

  const byTank: Record<string, Dip[]> = {};
  dips.forEach((d) => (byTank[d.tankId] ??= []).push(d));
  const delByTank: Record<string, Delivery[]> = {};
  deliveries.forEach((d) => (delByTank[d.tankId] ??= []).push(d));

  const out: Segment[] = [];
  Object.entries(byTank).forEach(([tankId, list]) => {
    list.sort((a, b) => a.order - b.order);
    const dels = (delByTank[tankId] ?? []).slice();
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      // Deliveries dated after the previous dip's date and up to this dip's date
      // belong to this segment; same-day deliveries go to the first segment of that day.
      const firstOfDay = prev.date !== cur.date;
      const delivered = dels
        .filter((d) => (firstOfDay ? d.date > prev.date && d.date <= cur.date : false))
        .reduce((s, d) => s + d.qty, 0);
      const tankSales = prev.level - cur.level + delivered;
      const meterSales = meterByTank[meterKey(tankId, cur.date, cur.shiftKey)] ?? 0;
      out.push({ tankId, date: cur.date, shiftKey: cur.shiftKey, opening: prev.level, closing: cur.level, deliveries: delivered, tankSales, meterSales, variance: tankSales - meterSales });
    }
  });
  return out;
}

export interface StockGap { tankId: string; throughput: number; cumulativeGap: number; gapPct: number }

/** Cumulative unexplained loss (+) or gain (−) per tank over the period. */
export function stockGaps(segments: Segment[]): StockGap[] {
  const m: Record<string, StockGap> = {};
  segments.forEach((s) => {
    const g = (m[s.tankId] ??= { tankId: s.tankId, throughput: 0, cumulativeGap: 0, gapPct: 0 });
    g.throughput += s.meterSales;
    g.cumulativeGap += s.variance;
  });
  return Object.values(m).map((g) => ({ ...g, gapPct: g.throughput ? (g.cumulativeGap / g.throughput) * 100 : 0 }));
}

export interface PumpEfficiency { pumpId: string; totalUsg: number; shifts: number; avgPerShift: number; utilisationPct: number }

/** Volume per shift worked, relative to the busiest pump (100%). */
export function pumpEfficiency(meters: MeterRow[]): PumpEfficiency[] {
  const m: Record<string, { total: number; shifts: Set<string> }> = {};
  meters.forEach((r) => {
    const p = (m[r.pumpId] ??= { total: 0, shifts: new Set() });
    p.total += r.usg; p.shifts.add(`${r.date}|${r.shiftKey}`);
  });
  const rows = Object.entries(m).map(([pumpId, v]) => ({ pumpId, totalUsg: v.total, shifts: v.shifts.size, avgPerShift: v.shifts.size ? v.total / v.shifts.size : 0, utilisationPct: 0 }));
  const best = Math.max(0, ...rows.map((r) => r.avgPerShift));
  return rows.map((r) => ({ ...r, utilisationPct: best ? (r.avgPerShift / best) * 100 : 0 })).sort((a, b) => b.totalUsg - a.totalUsg);
}

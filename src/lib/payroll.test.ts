import { describe, it, expect } from "vitest";
import { computePayrollLine, computePayrollBreakdown, DEFAULT_PAYROLL_TEMPLATE as T } from "./payroll";

describe("payroll template", () => {
  it("matches spreadsheet row for $150, 31 days", () => {
    const l = computePayrollLine(150, 31, 0, T);
    expect(l.annualLRD).toBe(313200);
    expect(l.incomeTax).toBeCloseTo(23480, 2); // (313200-200000)*0.15+6500
    expect(l.nasEmployee).toBeCloseTo(4.5, 4);
    expect(l.nasEmployer).toBeCloseTo(7.125, 4);
    expect(l.netPr).toBeCloseTo(150 - 23480 / 12 / 174 - 4.5, 4);
  });
  it("prorates by days worked and subtracts deductions after rounding", () => {
    const l = computePayrollLine(155, 15.5, 5, T);
    expect(l.grossPr).toBe(77.5);
    expect(l.roundedNetUSD).toBe(Math.round(l.netPr) - 5);
  });
  it("full breakdown subtracts lateness, advances and shortages", () => {
    const b = computePayrollBreakdown({ salary: 155, daysWorked: 15.5, lateCount: 3, advances: 10, shortages: 4 }, T);
    expect(b.earnings.proratedGross).toBe(77.5);
    expect(b.otherDeductions.latenessPenalty).toBe(3);
    expect(b.otherDeductions.total).toBe(17);
    const base = computePayrollLine(155, 15.5, 0, T);
    expect(b.totals.netPayUSD).toBe(base.roundedNetUSD - 17);
    expect(b.totals.netPayLRD).toBe((base.roundedNetUSD - 17) * 174);
  });
});

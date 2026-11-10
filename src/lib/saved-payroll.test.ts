import { describe, expect, it } from "vitest";
import { savedPayrollLine } from "./saved-payroll";

describe("saved payroll history", () => {
  it("preserves legacy saved gross, deductions, days and net instead of showing zero", () => {
    expect(savedPayrollLine({ gross_salary: 600, net_salary: 570, days_worked: 31, deductions: 30, other_deductions: 0, details: {} }))
      .toMatchObject({ gross: 600, grossPr: 600, roundedNetUSD: 570, daysWorked: 31, deductions: 30, incomeTaxUSDPr: 0, nasEmployee: 0 });
  });
  it("retains itemized amounts and uses the stored net salary as authoritative", () => {
    expect(savedPayrollLine({ gross_salary: 600, net_salary: 490, days_worked: 26, deductions: 10, other_deductions: 5,
      details: { grossPr: 500, nasEmployee: 5, deductions: 5, exchange_rate: 174 } }))
      .toMatchObject({ grossPr: 500, nasEmployee: 5, deductions: 5, roundedNetUSD: 490, roundedNetLRD: 85260 });
  });
});
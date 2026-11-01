import { describe, it, expect } from "vitest";
import { latestRunsByStation } from "./StationPayrollCard";

const row = (b: string, y: number, m: number, gross: number, net: number) =>
  ({ year: y, month: m, gross_salary: gross, net_salary: net, details: { grossPr: gross }, employees: { branch_id: b, branches: { name: b } } });

describe("latest payroll per station", () => {
  it("keeps only each station's most recent month and totals it", () => {
    const r = latestRunsByStation([row("A", 2026, 9, 100, 90), row("A", 2026, 10, 150, 130), row("A", 2026, 10, 50, 45), row("B", 2025, 12, 80, 70)]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ branchId: "A", month: 10, employees: 2, gross: 200, net: 175, deductions: 25 });
    expect(r[1]).toMatchObject({ branchId: "B", year: 2025, month: 12 });
  });
});

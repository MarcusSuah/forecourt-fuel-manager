import type { PayrollLine } from "./payroll";

export interface SavedPayrollRecord {
  gross_salary: number;
  net_salary: number;
  days_worked: number;
  deductions: number;
  other_deductions: number;
  details: unknown;
}

/** Preserve saved amounts; never recalculate historical pay using today's rates. */
export function savedPayrollLine(record: SavedPayrollRecord): PayrollLine {
  const details = record.details && typeof record.details === "object" && !Array.isArray(record.details)
    ? record.details as Record<string, unknown> : {};
  const value = (key: string, fallback = 0): number => {
    const raw = details[key];
    const number = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(number) ? number : fallback;
  };
  const gross = value("gross", Number(record.gross_salary));
  const grossPr = value("grossPr", Number(record.gross_salary));
  const net = Number(record.net_salary);
  const fx = value("exchange_rate");
  const other = Number(record.other_deductions) || 0;
  const hasBreakdown = typeof details.grossPr === "number";
  return {
    gross, annualUSD: value("annualUSD"), annualLRD: value("annualLRD"),
    incomeTax: value("incomeTax"), monthlyTaxLD: value("monthlyTaxLD"),
    daysWorked: value("daysWorked", Number(record.days_worked) || 0), grossPr,
    annualUSDPr: value("annualUSDPr"), annualLRDPr: value("annualLRDPr"),
    incomeTaxPr: value("incomeTaxPr"), monthlyTaxLDPr: value("monthlyTaxLDPr"),
    incomeTaxUSDPr: value("incomeTaxUSDPr"), nasEmployee: value("nasEmployee"),
    nasEmployer: value("nasEmployer"), nasTotal: value("nasTotal"),
    netPr: value("netPr", net + other),
    // Legacy records have only a combined deduction, not a statutory breakdown.
    deductions: hasBreakdown ? value("deductions", other) : Number(record.deductions) || 0,
    roundedNetUSD: net, roundedNetLRD: value("roundedNetLRD", net * fx),
  };
}
// Payroll calculation mirroring the station Payroll_2026.xlsx template.
export interface TaxBracket { from: number; upTo: number | null; rate: number; base: number }
export interface PayrollTemplate {
  exchange_rate: number;          // LRD per 1 USD
  employee_ss_rate: number;       // NASCORP employee
  employer_ss_rate: number;       // NASCORP employer
  days_in_month: number;
  brackets: TaxBracket[];         // annual LRD income tax brackets
  prepared_by_label: string;
  checked_by_label: string;
  approved_by_label: string;
}

export const DEFAULT_PAYROLL_TEMPLATE: PayrollTemplate = {
  exchange_rate: 174,
  employee_ss_rate: 0.03,
  employer_ss_rate: 0.0475,
  days_in_month: 31,
  brackets: [
    { from: 0, upTo: 70000, rate: 0, base: 0 },
    { from: 70000, upTo: 200000, rate: 0.05, base: 0 },
    { from: 200000, upTo: 800000, rate: 0.15, base: 6500 },
    { from: 800000, upTo: null, rate: 0.25, base: 96500 },
  ],
  prepared_by_label: "YOUNG DEALER",
  checked_by_label: "RETAIL SALES EXECUTIVE",
  approved_by_label: "RETAIL SALES & DEVELOPMENT MANAGER",
};

export function annualTaxLRD(annualLRD: number, brackets: TaxBracket[]): number {
  const b = brackets.find((x) => x.upTo === null || annualLRD <= x.upTo) ?? brackets[brackets.length - 1];
  if (!b) return 0;
  return Math.max(0, (annualLRD - b.from) * b.rate + b.base);
}

export interface PayrollLine {
  gross: number; annualUSD: number; annualLRD: number; incomeTax: number; monthlyTaxLD: number;
  daysWorked: number; grossPr: number; annualUSDPr: number; annualLRDPr: number;
  incomeTaxPr: number; monthlyTaxLDPr: number; incomeTaxUSDPr: number;
  nasEmployee: number; nasEmployer: number; nasTotal: number; netPr: number;
  deductions: number; roundedNetUSD: number; roundedNetLRD: number;
}

export function computePayrollLine(gross: number, daysWorked: number, deductions: number, t: PayrollTemplate): PayrollLine {
  const fx = t.exchange_rate;
  const annualUSD = gross * 12;
  const annualLRD = annualUSD * fx;
  const incomeTax = annualTaxLRD(annualLRD, t.brackets);
  const grossPr = (gross * daysWorked) / t.days_in_month;
  const annualUSDPr = grossPr * 12;
  const annualLRDPr = annualUSDPr * fx;
  const incomeTaxPr = annualTaxLRD(annualLRDPr, t.brackets);
  const monthlyTaxLDPr = incomeTaxPr / 12;
  const incomeTaxUSDPr = fx ? monthlyTaxLDPr / fx : 0;
  const nasEmployee = grossPr * t.employee_ss_rate;
  const nasEmployer = grossPr * t.employer_ss_rate;
  const netPr = grossPr - incomeTaxUSDPr - nasEmployee;
  const roundedNetUSD = Math.round(netPr) - deductions;
  return {
    gross, annualUSD, annualLRD, incomeTax, monthlyTaxLD: incomeTax / 12, daysWorked,
    grossPr, annualUSDPr, annualLRDPr, incomeTaxPr, monthlyTaxLDPr, incomeTaxUSDPr,
    nasEmployee, nasEmployer, nasTotal: nasEmployee + nasEmployer, netPr, deductions,
    roundedNetUSD, roundedNetLRD: roundedNetUSD * fx,
  };
}

export function mergeTemplate(v: unknown): PayrollTemplate {
  return { ...DEFAULT_PAYROLL_TEMPLATE, ...((v as Partial<PayrollTemplate>) ?? {}) };
}

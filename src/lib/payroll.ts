// Payroll calculation mirroring the station Payroll_2026.xlsx template.
export interface TaxBracket { from: number; upTo: number | null; rate: number; base: number }
export interface PayrollTemplate {
  exchange_rate: number;          // LRD per 1 USD
  employee_ss_rate: number;       // NASCORP employee
  employer_ss_rate: number;       // NASCORP employer
  days_in_month: number;
  brackets: TaxBracket[];         // annual LRD income tax brackets
  lateness_penalty_usd: number;   // USD deducted per late arrival
  prepared_by_label: string;
  checked_by_label: string;
  approved_by_label: string;
}

export const DEFAULT_PAYROLL_TEMPLATE: PayrollTemplate = {
  exchange_rate: 174,
  employee_ss_rate: 0.03,
  employer_ss_rate: 0.0475,
  days_in_month: 31,
  lateness_penalty_usd: 1,
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

// ---------- Full itemized payroll model ----------
export interface PayrollInput {
  name?: string;
  salary: number;       // monthly gross, USD
  daysWorked: number;
  lateCount?: number;   // number of late arrivals
  advances?: number;    // USD advanced during the month
  shortages?: number;   // USD cash/fuel shortages charged to employee
}

export interface PayrollBreakdownItem { label: string; amountUSD: number; amountLRD: number }

export interface PayrollBreakdown {
  name?: string;
  inputs: Required<Omit<PayrollInput, "name">>;
  earnings: { monthlySalary: number; dailyRate: number; daysWorked: number; daysAbsent: number; absenceDeduction: number; proratedGross: number };
  tax: { annualTaxableUSD: number; annualTaxableLRD: number; bracketRate: number; annualTaxLRD: number; monthlyTaxLRD: number; monthlyTaxUSD: number };
  socialSecurity: { employeeRate: number; employerRate: number; employee: number; employer: number; total: number };
  otherDeductions: { lateCount: number; latenessPenalty: number; advances: number; shortages: number; total: number };
  items: PayrollBreakdownItem[];  // ordered line items, deductions negative
  totals: { gross: number; statutoryDeductions: number; otherDeductions: number; totalDeductions: number; netBeforeRounding: number; netPayUSD: number; netPayLRD: number; employerCost: number };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computePayrollBreakdown(input: PayrollInput, t: PayrollTemplate): PayrollBreakdown {
  const fx = t.exchange_rate;
  const salary = Math.max(0, input.salary || 0);
  const days = Math.min(Math.max(0, input.daysWorked || 0), t.days_in_month);
  const lateCount = Math.max(0, Math.floor(input.lateCount || 0));
  const advances = Math.max(0, input.advances || 0);
  const shortages = Math.max(0, input.shortages || 0);
  const latenessPenalty = lateCount * (t.lateness_penalty_usd ?? 0);
  const other = latenessPenalty + advances + shortages;

  const line = computePayrollLine(salary, days, other, t);
  const bracket = t.brackets.find((x) => x.upTo === null || line.annualLRDPr <= x.upTo);
  const dailyRate = t.days_in_month ? salary / t.days_in_month : 0;
  const statutory = line.incomeTaxUSDPr + line.nasEmployee;

  const items: PayrollBreakdownItem[] = [
    { label: "Monthly salary", amountUSD: salary },
    { label: `Absence (${r2(t.days_in_month - days)} days)`, amountUSD: -(salary - line.grossPr) },
    { label: "Income tax", amountUSD: -line.incomeTaxUSDPr },
    { label: "NASCORP (employee)", amountUSD: -line.nasEmployee },
    { label: "Rounding", amountUSD: Math.round(line.netPr) - line.netPr },
    { label: `Lateness (${lateCount}×)`, amountUSD: -latenessPenalty },
    { label: "Salary advances", amountUSD: -advances },
    { label: "Shortages", amountUSD: -shortages },
  ].map((i) => ({ label: i.label, amountUSD: r2(i.amountUSD), amountLRD: r2(i.amountUSD * fx) }));

  return {
    name: input.name,
    inputs: { salary, daysWorked: days, lateCount, advances, shortages },
    earnings: { monthlySalary: salary, dailyRate: r2(dailyRate), daysWorked: days, daysAbsent: t.days_in_month - days, absenceDeduction: r2(salary - line.grossPr), proratedGross: r2(line.grossPr) },
    tax: { annualTaxableUSD: r2(line.annualUSDPr), annualTaxableLRD: r2(line.annualLRDPr), bracketRate: bracket?.rate ?? 0, annualTaxLRD: r2(line.incomeTaxPr), monthlyTaxLRD: r2(line.monthlyTaxLDPr), monthlyTaxUSD: r2(line.incomeTaxUSDPr) },
    socialSecurity: { employeeRate: t.employee_ss_rate, employerRate: t.employer_ss_rate, employee: r2(line.nasEmployee), employer: r2(line.nasEmployer), total: r2(line.nasTotal) },
    otherDeductions: { lateCount, latenessPenalty: r2(latenessPenalty), advances: r2(advances), shortages: r2(shortages), total: r2(other) },
    items,
    totals: {
      gross: r2(line.grossPr), statutoryDeductions: r2(statutory), otherDeductions: r2(other),
      totalDeductions: r2(statutory + other), netBeforeRounding: r2(line.netPr - other),
      netPayUSD: line.roundedNetUSD, netPayLRD: line.roundedNetLRD, employerCost: r2(line.grossPr + line.nasEmployer),
    },
  };
}

export function computeStationPayroll(rows: PayrollInput[], t: PayrollTemplate) {
  const employees = rows.map((r) => computePayrollBreakdown(r, t));
  const sum = (f: (b: PayrollBreakdown) => number) => r2(employees.reduce((a, b) => a + f(b), 0));
  return {
    employees,
    totals: {
      gross: sum((b) => b.totals.gross), incomeTax: sum((b) => b.tax.monthlyTaxUSD),
      nasEmployee: sum((b) => b.socialSecurity.employee), nasEmployer: sum((b) => b.socialSecurity.employer),
      lateness: sum((b) => b.otherDeductions.latenessPenalty), advances: sum((b) => b.otherDeductions.advances),
      shortages: sum((b) => b.otherDeductions.shortages), netPayUSD: sum((b) => b.totals.netPayUSD),
      netPayLRD: sum((b) => b.totals.netPayLRD), employerCost: sum((b) => b.totals.employerCost),
    },
  };
}

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessScope } from "@/hooks/useAccessScope";
import { usePayrollTemplate } from "@/hooks/usePayrollTemplate";
import { computePayrollLine, PayrollLine, PayrollTemplate } from "@/lib/payroll";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, Play, Printer, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { PayrollHistory } from "@/components/payroll/PayrollHistory";
import { PayrollAssistant } from "@/components/payroll/PayrollAssistant";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const f2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export interface PrintCtx { name?: string | null; location?: string | null; period: string; fx: number; date?: string }
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const COLS: [string, keyof PayrollLine][] = [
  ["Gross Salary", "gross"], ["Annual Gross USD", "annualUSD"], ["Annual Gross LRD", "annualLRD"], ["Income Tax", "incomeTax"],
  ["Monthly Tax LD", "monthlyTaxLD"], ["Days Worked", "daysWorked"], ["Gross (pr)", "grossPr"], ["Annual Gross USD (pr)", "annualUSDPr"],
  ["Annual Gross LRD (pr)", "annualLRDPr"], ["Income Tax (pr)", "incomeTaxPr"], ["Monthly Tax LD (pr)", "monthlyTaxLDPr"],
  ["Income Tax USD (pr)", "incomeTaxUSDPr"], ["NASCORP Employee (pr)", "nasEmployee"], ["NASCORP Employer (pr)", "nasEmployer"],
  ["Total NASCORP (pr)", "nasTotal"], ["Net Salary (pr)", "netPr"], ["Deduction Lateness & Advances/Shortages", "deductions"],
  ["Rounded Net Salary (pr) USD", "roundedNetUSD"], ["Rounded Net Salary (pr) LRD", "roundedNetLRD"],
];

export default function Payroll() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const scope = useAccessScope();
  const { data: tpl } = usePayrollTemplate();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [branchId, setBranchId] = useState<string>("");
  const [inputs, setInputs] = useState<Record<string, { days: number; ded: number }>>({});

  const { data: branches } = useQuery({
    queryKey: ["payroll-branches"],
    queryFn: async () => (await supabase.from("branches").select("id, name, location").eq("is_active", true).order("name")).data ?? [],
  });
  const visibleBranches = (branches ?? []).filter((b) => !scope.allowedBranchIds || scope.allowedBranchIds.includes(b.id));
  useEffect(() => {
    if (!branchId && (scope.defaultBranchId || visibleBranches[0])) setBranchId(scope.defaultBranchId ?? visibleBranches[0].id);
  }, [scope.defaultBranchId, visibleBranches, branchId]);
  const branch = visibleBranches.find((b) => b.id === branchId);
  const isDealer = user?.role === "dealer";

  const { data: employees } = useQuery({
    queryKey: ["payroll-employees", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, position, gender, gross_salary")
        .eq("is_active", true).eq("branch_id", branchId).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records } = useQuery({
    queryKey: ["payroll", month, year, branchId],
    enabled: !!employees,
    queryFn: async () => {
      const ids = employees!.map((e) => e.id);
      if (!ids.length) return [];
      const { data, error } = await supabase.from("payroll").select("*").in("employee_id", ids)
        .eq("month", +month).eq("year", +year);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const next: Record<string, { days: number; ded: number }> = {};
    employees?.forEach((e) => {
      const r = records?.find((x) => x.employee_id === e.id);
      next[e.id] = { days: r ? Number(r.days_worked) : tpl?.days_in_month ?? 31, ded: r ? Number(r.other_deductions) : 0 };
    });
    setInputs(next);
  }, [employees, records, tpl]);

  const lastDay = new Date(+year, +month, 0).getDate();
  const periodLabel = `01-${MONTHS[+month - 1]}-${year} - ${lastDay}-${MONTHS[+month - 1]}-${year}`;

  const rows = useMemo(() => {
    if (!tpl || !employees) return [];
    return employees.map((e) => {
      const i = inputs[e.id] ?? { days: tpl.days_in_month, ded: 0 };
      return { emp: e, line: computePayrollLine(Number(e.gross_salary), i.days, i.ded, tpl), saved: records?.some((r) => r.employee_id === e.id) };
    });
  }, [employees, inputs, tpl, records]);

  const totals = useMemo(() => {
    const t: Partial<Record<keyof PayrollLine, number>> = {};
    rows.forEach(({ line }) => COLS.forEach(([, k]) => { if (k !== "daysWorked") t[k] = (t[k] ?? 0) + line[k]; }));
    return t;
  }, [rows]);
  const totalPayable = (totals.incomeTaxUSDPr ?? 0) + (totals.nasEmployee ?? 0) + (totals.nasEmployer ?? 0) + (totals.roundedNetUSD ?? 0);

  const generate = useMutation({
    mutationFn: async () => {
      if (!rows.length) throw new Error("No active employees for this station");
      const payload = rows.map(({ emp, line }) => ({
        employee_id: emp.id, month: +month, year: +year,
        gross_salary: line.gross, bonuses: 0,
        deductions: +(line.incomeTaxUSDPr + line.nasEmployee + line.deductions).toFixed(2),
        net_salary: line.roundedNetUSD, days_worked: line.daysWorked, other_deductions: line.deductions,
        details: { ...line, exchange_rate: tpl!.exchange_rate, period: periodLabel } as any,
        status: "processed", created_by: user?.id,
      }));
      const { error } = await supabase.from("payroll").upsert(payload, { onConflict: "employee_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`Payroll saved for ${MONTHS[+month - 1]} ${year}`); qc.invalidateQueries({ queryKey: ["payroll"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const curCtx = (): PrintCtx => ({ name: branch?.name, location: branch?.location, period: periodLabel, fx: tpl?.exchange_rate ?? 0 });
  const header = (t: PayrollTemplate, c: PrintCtx = curCtx()) => `
    <table class="hd"><tr><td><b>STATION NAME:</b></td><td>${esc(c.name)}</td></tr>
    <tr><td><b>LOCATION:</b></td><td>${esc(c.location)}</td></tr>
    <tr><td><b>PAYROLL PERIOD:</b></td><td>${esc(c.period)}</td></tr>
    <tr><td><b>PAYROLL DATE:</b></td><td>${c.date ?? new Date().toLocaleDateString()}</td></tr>
    <tr><td><b>Exchange Rate:</b></td><td>${c.fx} LRD / USD</td></tr>
    <tr><td><b>Employee Social Security rate:</b></td><td>${(t.employee_ss_rate * 100).toFixed(2)}%</td></tr>
    <tr><td><b>Employer Social Security rate:</b></td><td>${(t.employer_ss_rate * 100).toFixed(2)}%</td></tr></table>`;
  const sign = (t: PayrollTemplate) => `<div class="sig">
    <div>PREPARED BY:<br/>______________________<br/>${esc(t.prepared_by_label)}</div>
    <div>CHECK BY:<br/>______________________<br/>${esc(t.checked_by_label)}</div>
    <div>APPROVED BY:<br/>______________________<br/>${esc(t.approved_by_label)}</div></div>`;
  const css = `body{font-family:Arial,sans-serif;padding:24px;font-size:11px}table{border-collapse:collapse}
    .grid td,.grid th{border:1px solid #444;padding:4px;text-align:right}.grid th{background:#eee;font-size:10px}
    .grid td.l{text-align:left}.hd td{padding:2px 8px}.sig{display:flex;justify-content:space-between;margin-top:40px}
    @page{size:landscape}`;

  const openPrint = (title: string, body: string) => {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Please allow popups");
    w.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><style>${css}</style></head><body>${body}<script>setTimeout(()=>print(),300)</script></body></html>`);
    w.document.close();
  };

  const printSheet = (list: { emp: any; line: PayrollLine }[] = rows, c: PrintCtx = curCtx()) => {
    if (!tpl || !list.length) return toast.error("No payroll data");
    const tot: Partial<Record<keyof PayrollLine, number>> = {};
    list.forEach(({ line }) => COLS.forEach(([, k]) => { tot[k] = (tot[k] ?? 0) + (Number(line[k]) || 0); }));
    const payable = (tot.incomeTaxUSDPr ?? 0) + (tot.nasEmployee ?? 0) + (tot.nasEmployer ?? 0) + (tot.roundedNetUSD ?? 0);
    const head = `<tr><th>#</th><th>SEX</th><th>FULL NAME</th><th>JOB POSITION</th>${COLS.map(([l]) => `<th>${l}</th>`).join("")}<th>Signature</th></tr>`;
    const body = list.map(({ emp, line }, i) => `<tr><td>${i + 1}</td><td class="l">${esc(emp.gender?.[0] ?? "")}</td><td class="l">${esc(emp.full_name)}</td><td class="l">${esc(emp.position)}</td>${COLS.map(([, k]) => `<td>${k === "daysWorked" ? line[k] : f2(Number(line[k]) || 0)}</td>`).join("")}<td></td></tr>`).join("");
    const foot = `<tr><td colspan="4"><b>Total:</b></td>${COLS.map(([, k]) => `<td><b>${k === "daysWorked" ? "" : f2(tot[k] ?? 0)}</b></td>`).join("")}<td></td></tr>`;
    openPrint(`Payroll ${c.period}`, `${header(tpl, c)}<br/><table class="grid">${head}${body}${foot}</table>
      <p style="text-align:right"><b>Total salaries & wages payable: $${f2(payable)}</b></p>${sign(tpl)}`);
  };

  const printSlip = (emp: any, line: PayrollLine, c: PrintCtx = curCtx()) => {
    if (!tpl) return;
    const r = (l: string, v: string) => `<tr><td class="l">${l}</td><td>${v}</td></tr>`;
    openPrint(`Payslip - ${emp.full_name}`, `<h2 style="text-align:center">PAYSLIP</h2>${header(tpl, c)}<br/>
      <table class="grid" style="width:100%">
      ${r("Employee", esc(emp.full_name))}${r("Job position", esc(emp.position))}${r("Sex", esc(emp.gender ?? ""))}
      ${r("Gross salary (USD)", f2(line.gross))}${r("Days worked", String(line.daysWorked))}${r("Gross prorated (USD)", f2(line.grossPr))}
      ${r("Annual gross prorated (LRD)", f2(line.annualLRDPr))}${r("Income tax monthly (LD)", f2(line.monthlyTaxLDPr))}
      ${r("Income tax (USD)", "-" + f2(line.incomeTaxUSDPr))}${r("NASCORP employee (USD)", "-" + f2(line.nasEmployee))}
      ${r("NASCORP employer (USD) — paid by employer", f2(line.nasEmployer))}${r("Net salary (USD)", f2(line.netPr))}
      ${r("Lateness, advances & shortages (USD)", "-" + f2(line.deductions))}
      ${r("<b>Rounded net pay (USD)</b>", "<b>$" + f2(line.roundedNetUSD) + "</b>")}${r("<b>Rounded net pay (LRD)</b>", "<b>L$" + f2(line.roundedNetLRD) + "</b>")}
      </table><div class="sig"><div>Employee signature<br/><br/>______________________</div><div>${esc(tpl.prepared_by_label)}<br/><br/>______________________</div></div>`);
  };

  const exportCSV = () => {
    if (!rows.length) return toast.error("No payroll data");
    downloadCSV(`payroll-${MONTHS[+month - 1]}-${year}.csv`, ["#", "Sex", "Full Name", "Job Position", "Payroll Period", ...COLS.map(([l]) => l)],
      rows.map(({ emp, line }, i) => [String(i + 1), emp.gender ?? "", emp.full_name, emp.position, periodLabel, ...COLS.map(([, k]) => line[k].toFixed(2))]));
  };

  const setIn = (id: string, k: "days" | "ded", v: string) => setInputs((p) => ({ ...p, [id]: { ...p[id], [k]: Number(v) } }));

  return (
    <AppLayout title="Payroll" subtitle="Generate station payroll and payslips from the payroll template">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Payroll Period</CardTitle>
            <CardDescription>
              Exchange rate {tpl?.exchange_rate} LRD/USD · Employee SS {((tpl?.employee_ss_rate ?? 0) * 100).toFixed(2)}% · Employer SS {((tpl?.employer_ss_rate ?? 0) * 100).toFixed(2)}% (set by admin in Settings)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Station</Label>
                <Select value={branchId} onValueChange={setBranchId} disabled={isDealer}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Select station" /></SelectTrigger>
                  <SelectContent>{visibleBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{[2024, 2025, 2026, 2027, 2028].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => generate.mutate()} disabled={generate.isPending || !scope.canWriteBranch(branchId)}>
                <Play className="h-4 w-4 mr-1" /> Generate Payroll
              </Button>
              <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
              <Button variant="outline" onClick={() => printSheet()}><Printer className="h-4 w-4 mr-1" /> Print sheet / PDF</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{branch?.name ?? "Station"} — {periodLabel}</CardTitle>
            <CardDescription>Edit days worked and deductions, then Generate Payroll to save.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead><TableHead>Sex</TableHead><TableHead>Full Name</TableHead><TableHead>Job Position</TableHead>
                    {COLS.map(([l]) => <TableHead key={l} className="text-right whitespace-nowrap">{l}</TableHead>)}
                    <TableHead>Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!rows.length ? (
                    <TableRow><TableCell colSpan={COLS.length + 5} className="text-center py-8 text-muted-foreground">No active employees for this station.</TableCell></TableRow>
                  ) : rows.map(({ emp, line, saved }, i) => (
                    <TableRow key={emp.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{emp.gender?.[0] ?? ""}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{emp.full_name}{saved && <span className="ml-1 text-primary">•</span>}</TableCell>
                      <TableCell className="whitespace-nowrap">{emp.position}</TableCell>
                      {COLS.map(([, k]) => (
                        <TableCell key={k} className="text-right font-mono">
                          {k === "daysWorked" ? (
                            <Input type="number" className="h-7 w-16 text-right" value={inputs[emp.id]?.days ?? ""} onChange={(e) => setIn(emp.id, "days", e.target.value)} />
                          ) : k === "deductions" ? (
                            <Input type="number" className="h-7 w-20 text-right" value={inputs[emp.id]?.ded ?? ""} onChange={(e) => setIn(emp.id, "ded", e.target.value)} />
                          ) : f2(line[k])}
                        </TableCell>
                      ))}
                      <TableCell><Button size="sm" variant="ghost" onClick={() => printSlip(emp, line)}><Printer className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {rows.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Total</TableCell>
                      {COLS.map(([, k]) => <TableCell key={k} className="text-right font-mono">{k === "daysWorked" ? "" : f2(totals[k] ?? 0)}</TableCell>)}
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
            {rows.length > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm flex justify-between">
                <span className="text-muted-foreground">Total salaries & wages payable</span>
                <span className="font-bold text-lg">${f2(totalPayable)} USD</span>
              </div>
            )}
          </CardContent>
        </Card>

        <PayrollHistory branches={visibleBranches} lockBranch={isDealer ? branchId : undefined}
          onPrintSheet={printSheet} onPrintSlip={printSlip} />
        {(isDealer || user?.role === "admin") && branchId && (
          <PayrollAssistant branchId={branchId} branchName={branch?.name} month={+month} year={+year} />
        )}
      </div>
    </AppLayout>
  );
}

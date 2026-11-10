import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollLine } from "@/lib/payroll";
import { savedPayrollLine } from "@/lib/saved-payroll";
import type { PrintCtx } from "@/pages/Payroll";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, FolderOpen, Printer } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const f2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Branch = { id: string; name: string; location: string | null };
type Item = { emp: { full_name: string; position: string; gender: string | null }; line: PayrollLine };
type Run = { key: string; branch?: Branch; month: number; year: number; items: Item[]; net: number; ctx: PrintCtx; savedAt: string };

interface Props {
  branches: Branch[];
  lockBranch?: string;
  onPrintSheet: (list: Item[], c: PrintCtx) => void;
  onPrintSlip: (emp: Item["emp"], line: PayrollLine, c: PrintCtx) => void;
}

export function PayrollHistory({ branches, lockBranch, onPrintSheet, onPrintSlip }: Props) {
  const [params] = useSearchParams();
  const [station, setStation] = useState(params.get("station") ?? "all");
  const [year, setYear] = useState(params.get("year") ?? String(new Date().getFullYear()));
  const [month, setMonth] = useState(params.get("month") ?? "all");
  const wantRun = params.get("station") && params.get("month") ? `${params.get("station")}-${params.get("year")}-${params.get("month")}` : null;
  const [open, setOpen] = useState<Run | null>(null);
  const effStation = lockBranch ?? station;
  const ids = branches.map((b) => b.id);

  const { data } = useQuery({
    queryKey: ["payroll-history", effStation, year, month, ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      let q = supabase.from("payroll")
        .select("month, year, gross_salary, net_salary, days_worked, deductions, other_deductions, details, created_at, employees!inner(full_name, position, gender, branch_id)")
        .eq("year", +year);
      q = effStation === "all" ? q.in("employees.branch_id", ids) : q.eq("employees.branch_id", effStation);
      if (month !== "all") q = q.eq("month", +month);
      const { data, error } = await q.order("month", { ascending: false }).limit(2000);
      if (error) throw error;
      return data as any[];
    },
  });

  const runs = useMemo<Run[]>(() => {
    const map = new Map<string, Run>();
    (data ?? []).forEach((r) => {
      const bId = r.employees.branch_id;
      const key = `${bId}-${r.year}-${r.month}`;
      const d = r.details ?? {};
      let run = map.get(key);
      if (!run) {
        const branch = branches.find((b) => b.id === bId);
        const last = new Date(r.year, r.month, 0).getDate();
        run = {
          key, branch, month: r.month, year: r.year, items: [], net: 0, savedAt: r.created_at,
          ctx: {
            name: branch?.name, location: branch?.location, fx: Number(d.exchange_rate) || 0,
            period: d.period ?? `01-${MONTHS[r.month - 1]}-${r.year} - ${last}-${MONTHS[r.month - 1]}-${r.year}`,
            date: new Date(r.created_at).toLocaleDateString(),
          },
        };
        map.set(key, run);
      }
      run.items.push({ emp: { full_name: r.employees.full_name, position: r.employees.position, gender: r.employees.gender }, line: savedPayrollLine(r) });
      run.net += Number(r.net_salary) || 0;
    });
    return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month || (a.branch?.name ?? "").localeCompare(b.branch?.name ?? ""));
  }, [data, branches]);

  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (!wantRun || autoOpened) return;
    const r = runs.find((x) => x.key === wantRun);
    if (r) { setOpen(r); setAutoOpened(true); document.getElementById("payroll-history")?.scrollIntoView({ behavior: "smooth" }); }
  }, [runs, wantRun, autoOpened]);

  return (
    <Card id="payroll-history">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Payroll History</CardTitle>
        <CardDescription>Saved payroll runs. Reopen a run to view payslips, or print the full sheet as it was saved.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          {!lockBranch && (
            <div className="space-y-1">
              <Label>Station</Label>
              <Select value={station} onValueChange={setStation}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stations</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[2024, 2025, 2026, 2027, 2028].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Station</TableHead><TableHead>Pay period</TableHead><TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Total net (USD)</TableHead><TableHead>Saved</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!runs.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No saved payroll runs for these filters.</TableCell></TableRow>
              ) : runs.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.branch?.name ?? "—"}</TableCell>
                  <TableCell>{MONTHS[r.month - 1]} {r.year}</TableCell>
                  <TableCell className="text-right">{r.items.length}</TableCell>
                  <TableCell className="text-right font-mono">${f2(r.net)}</TableCell>
                  <TableCell>{r.ctx.date}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(r)}><FolderOpen className="h-4 w-4 mr-1" /> Open</Button>
                    <Button size="sm" variant="ghost" onClick={() => onPrintSheet(r.items, r.ctx)}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{open?.branch?.name} — {open?.ctx.period}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead><TableHead>Position</TableHead><TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Gross (pr)</TableHead><TableHead className="text-right">Tax + NASCORP</TableHead>
                  <TableHead className="text-right">Other / unsplit ded.</TableHead><TableHead className="text-right">Net USD</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {open?.items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{it.emp.full_name}</TableCell>
                    <TableCell>{it.emp.position}</TableCell>
                    <TableCell className="text-right">{it.line.daysWorked}</TableCell>
                    <TableCell className="text-right font-mono">{f2(Number(it.line.grossPr) || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{f2((Number(it.line.incomeTaxUSDPr) || 0) + (Number(it.line.nasEmployee) || 0))}</TableCell>
                    <TableCell className="text-right font-mono">{f2(Number(it.line.deductions) || 0)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{f2(Number(it.line.roundedNetUSD) || 0)}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => onPrintSlip(it.emp, it.line, open.ctx)}><Printer className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => open && onPrintSheet(open.items, open.ctx)}><Printer className="h-4 w-4 mr-1" /> Print payroll sheet</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

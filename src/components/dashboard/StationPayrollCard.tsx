import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Wallet, ExternalLink } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface StationPayrollSummary {
  branchId: string; branchName: string; month: number; year: number;
  employees: number; gross: number; deductions: number; net: number;
}

/** Groups payroll rows into the latest run per station. */
export function latestRunsByStation(rows: any[]): StationPayrollSummary[] {
  const runs = new Map<string, StationPayrollSummary>();
  rows.forEach((r) => {
    const bId = r.employees?.branch_id; if (!bId) return;
    const key = `${bId}-${r.year}-${r.month}`;
    let run = runs.get(key);
    if (!run) {
      run = { branchId: bId, branchName: r.employees?.branches?.name ?? "—", month: r.month, year: r.year, employees: 0, gross: 0, deductions: 0, net: 0 };
      runs.set(key, run);
    }
    const d = r.details ?? {};
    const gross = Number(d.grossPr ?? r.gross_salary) || 0;
    const net = Number(r.net_salary) || 0;
    run.employees += 1; run.gross += gross; run.net += net; run.deductions += gross - net;
  });
  const latest = new Map<string, StationPayrollSummary>();
  runs.forEach((r) => {
    const cur = latest.get(r.branchId);
    if (!cur || r.year * 12 + r.month > cur.year * 12 + cur.month) latest.set(r.branchId, r);
  });
  return [...latest.values()].sort((a, b) => a.branchName.localeCompare(b.branchName));
}

export const payrollRunLink = (r: { branchId: string; year: number; month: number }) =>
  `/payroll?station=${r.branchId}&year=${r.year}&month=${r.month}`;

export function StationPayrollCard({ branchId }: { branchId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["station-payroll-latest", branchId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("payroll")
        .select("month, year, gross_salary, net_salary, details, employees!inner(branch_id, branches(name))")
        .order("year", { ascending: false }).order("month", { ascending: false }).limit(3000);
      if (branchId) q = q.eq("employees.branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
  const rows = useMemo(() => latestRunsByStation(data ?? []), [data]);
  const tot = rows.reduce((a, r) => ({ e: a.e + r.employees, g: a.g + r.gross, d: a.d + r.deductions, n: a.n + r.net }), { e: 0, g: 0, d: 0, n: 0 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Station Payroll (latest run)</CardTitle>
        <CardDescription>Each station's most recent saved payroll with net pay and totals.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payroll runs saved yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Station</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Staff</TableHead>
              <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net pay</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.branchId}>
                  <TableCell className="font-medium">{r.branchName}</TableCell>
                  <TableCell>{MONTHS[r.month - 1]} {r.year}</TableCell>
                  <TableCell className="text-right">{r.employees}</TableCell>
                  <TableCell className="text-right">{usd(r.gross)}</TableCell>
                  <TableCell className="text-right text-destructive">{usd(r.deductions)}</TableCell>
                  <TableCell className="text-right font-semibold">{usd(r.net)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost"><Link to={payrollRunLink(r)}><ExternalLink className="h-4 w-4 mr-1" />Open run</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2}>Total ({rows.length} stations)</TableCell>
                <TableCell className="text-right">{tot.e}</TableCell>
                <TableCell className="text-right">{usd(tot.g)}</TableCell>
                <TableCell className="text-right">{usd(tot.d)}</TableCell>
                <TableCell className="text-right">{usd(tot.n)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

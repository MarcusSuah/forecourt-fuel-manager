import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { Users, Wallet, DollarSign, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { latestRunsByStation, payrollRunLink } from "@/components/dashboard/StationPayrollCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAll } from "@/lib/fetch-all";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tip = { contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };
const axis = { tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" }, tickLine: false, axisLine: false };

export default function AdminPayroll() {
  const [station, setStation] = useState("all");

  const { data: branches } = useQuery({
    queryKey: ["ap-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error; return data;
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-payroll", station],
    queryFn: () => fetchAll<any>((a, b) => {
      let q = supabase.from("payroll").select("month, year, gross_salary, net_salary, employee_id, details, employees!inner(branch_id, branches(name))")
        .order("year", { ascending: false }).order("month", { ascending: false });
      if (station !== "all") q = q.eq("employees.branch_id", station);
      return q.range(a, b);
    }),
  });

  const view = useMemo(() => {
    const latest = latestRunsByStation(rows ?? []);
    const per: Record<string, { label: string; key: number; net: number; gross: number; staff: Set<string> }> = {};
    (rows ?? []).forEach((r) => {
      const key = r.year * 12 + r.month;
      const p = (per[key] ??= { label: `${MONTHS[r.month - 1]} ${String(r.year).slice(2)}`, key, net: 0, gross: 0, staff: new Set() });
      p.net += Number(r.net_salary) || 0;
      p.gross += Number(r.details?.grossPr ?? r.gross_salary) || 0;
      p.staff.add(r.employee_id);
    });
    const trend = Object.values(per).sort((a, b) => a.key - b.key).slice(-12).map((p) => ({ label: p.label, net: Math.round(p.net), gross: Math.round(p.gross), staff: p.staff.size }));
    const tot = latest.reduce((a, r) => ({ e: a.e + r.employees, g: a.g + r.gross, d: a.d + r.deductions, n: a.n + r.net }), { e: 0, g: 0, d: 0, n: 0 });
    return { latest, trend, tot };
  }, [rows]);

  return (
    <AppLayout title="Payroll Overview" subtitle="Latest payroll per station">
      <div className="page-stagger space-y-6">
        <div className="space-y-1">
          <Label className="text-xs">Station</Label>
          <Select value={station} onValueChange={setStation}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stations</SelectItem>
              {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger-grid">
          <MetricCard title="Stations with payroll" value={view.latest.length} icon={<CalendarDays className="h-4 w-4" />} />
          <MetricCard title="Staff (latest runs)" value={view.tot.e} icon={<Users className="h-4 w-4" />} />
          <MetricCard title="Gross (latest)" value={usd(view.tot.g)} icon={<DollarSign className="h-4 w-4" />} />
          <MetricCard title="Net pay (latest)" value={usd(view.tot.n)} icon={<Wallet className="h-4 w-4" />} variant="primary" />
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Payroll per period</CardTitle><CardDescription className="text-xs">Gross, net pay and staff paid — last 12 periods</CardDescription></CardHeader>
          <CardContent className="h-72 px-2 sm:px-6">
            <ResponsiveContainer>
              <ComposedChart data={view.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" {...axis} /><YAxis yAxisId="l" {...axis} width={60} /><YAxis yAxisId="r" orientation="right" allowDecimals={false} {...axis} width={30} />
                <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="gross" name="Gross ($)" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[4, 4, 0, 0]} animationDuration={900} />
                <Bar yAxisId="l" dataKey="net" name="Net ($)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} animationDuration={900} />
                <Line yAxisId="r" type="monotone" dataKey="staff" name="Staff" stroke="hsl(var(--accent))" strokeWidth={2} animationDuration={900} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {station === "all" && view.latest.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Net pay by station (latest run)</CardTitle></CardHeader>
            <CardContent className="h-72 px-2 sm:px-6">
              <ResponsiveContainer>
                <BarChart data={view.latest.map((r) => ({ name: r.branchName, net: Math.round(r.net) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis {...axis} width={60} />
                  <Tooltip {...tip} formatter={(v: number) => usd(v)} />
                  <Bar dataKey="net" name="Net pay" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Latest run per station</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : view.latest.length === 0 ? <p className="text-sm text-muted-foreground">No payroll runs saved yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Station</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Staff</TableHead>
                  <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net pay</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {view.latest.map((r) => (
                    <TableRow key={r.branchId}>
                      <TableCell className="font-medium">{r.branchName}</TableCell>
                      <TableCell>{MONTHS[r.month - 1]} {r.year}</TableCell>
                      <TableCell className="text-right">{r.employees}</TableCell>
                      <TableCell className="text-right">{usd(r.gross)}</TableCell>
                      <TableCell className="text-right">{usd(r.deductions)}</TableCell>
                      <TableCell className="text-right font-semibold">{usd(r.net)}</TableCell>
                      <TableCell className="text-right"><Button asChild size="sm" variant="ghost"><Link to={payrollRunLink(r)}>Open</Link></Button></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2}>Total</TableCell><TableCell className="text-right">{view.tot.e}</TableCell>
                    <TableCell className="text-right">{usd(view.tot.g)}</TableCell><TableCell className="text-right">{usd(view.tot.d)}</TableCell><TableCell className="text-right">{usd(view.tot.n)}</TableCell><TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

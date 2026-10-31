import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAccessScope } from "@/hooks/useAccessScope";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { latestRunsByStation, payrollRunLink } from "@/components/dashboard/StationPayrollCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Fuel, Droplets, Wallet, Gauge } from "lucide-react";
import { format } from "date-fns";

const n2 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function StationDashboard() {
  const scope = useAccessScope();
  const [branchId, setBranchId] = useState<string>("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: branches } = useQuery({
    queryKey: ["sd-branches", scope.allowedBranchIds?.join(",") ?? "all"],
    queryFn: async () => {
      let q = supabase.from("branches").select("id, name, zone").eq("is_active", true).order("name");
      if (scope.allowedBranchIds) q = q.in("id", scope.allowedBranchIds.length ? scope.allowedBranchIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (scope.defaultBranchId) setBranchId(scope.defaultBranchId);
    else if (!branchId && branches?.length) setBranchId(branches[0].id);
  }, [scope.defaultBranchId, branches, branchId]);

  const enabled = !!branchId;
  const q = <T,>(key: string, fn: () => Promise<T>) => useQuery({ queryKey: ["sd", key, branchId, date], enabled, queryFn: fn });

  const { data: tanks } = q("tanks", async () => {
    const { data, error } = await supabase.from("tanks").select("id, name, product_type, capacity_usg, current_level_usg, status").eq("branch_id", branchId).eq("is_active", true).order("name");
    if (error) throw error; return data;
  });
  const { data: dips } = q("dips", async () => {
    const { data, error } = await supabase.from("stock_readings").select("tank_id, physical_level_usg, theoretical_level_usg, created_at, shifts(name)").eq("branch_id", branchId).eq("date", date).order("created_at");
    if (error) throw error; return data as any[];
  });
  const { data: deliveries } = q("deliveries", async () => {
    const { data, error } = await supabase.from("fuel_deliveries").select("tank_id, quantity_usg").eq("branch_id", branchId).eq("delivery_date", date);
    if (error) throw error; return data;
  });
  const { data: meters } = q("meters", async () => {
    const { data, error } = await supabase.from("shift_sales_reports")
      .select("id, opening_meter, closing_meter, rtt_usg, sales_usg, total_sales_usd, pumps(name, product_type), shifts(name), attendants(full_name)")
      .eq("branch_id", branchId).eq("date", date).order("created_at");
    if (error) throw error; return data as any[];
  });
  const { data: payrollRows } = q("payroll", async () => {
    const { data, error } = await supabase.from("payroll").select("month, year, gross_salary, net_salary, details, employees!inner(branch_id, branches(name))")
      .eq("employees.branch_id", branchId).order("year", { ascending: false }).order("month", { ascending: false }).limit(500);
    if (error) throw error; return data as any[];
  });

  const sales = useMemo(() => {
    const s = { usd: 0, PMS: 0, AGO: 0 };
    (meters ?? []).forEach((m) => { s.usd += Number(m.total_sales_usd) || 0; const p = m.pumps?.product_type as "PMS" | "AGO"; if (p) s[p] += Number(m.sales_usg) || 0; });
    return s;
  }, [meters]);

  const dipRows = useMemo(() => (tanks ?? []).map((t) => {
    const rs = (dips ?? []).filter((d) => d.tank_id === t.id);
    const opening = rs.length ? Number(rs[0].theoretical_level_usg) || 0 : null;
    const closing = rs.length ? Number(rs[rs.length - 1].physical_level_usg) || 0 : null;
    const del = (deliveries ?? []).filter((d) => d.tank_id === t.id).reduce((a, d) => a + Number(d.quantity_usg), 0);
    const tankSales = opening != null && closing != null ? opening - closing + del : null;
    return { t, opening, closing, del, tankSales, readings: rs.length };
  }), [tanks, dips, deliveries]);

  const payroll = useMemo(() => latestRunsByStation(payrollRows ?? [])[0], [payrollRows]);
  const totalStock = (tanks ?? []).reduce((a, t) => a + Number(t.current_level_usg), 0);
  const totalCap = (tanks ?? []).reduce((a, t) => a + Number(t.capacity_usg), 0);
  const branchName = branches?.find((b) => b.id === branchId)?.name;

  return (
    <AppLayout title="Station Dashboard" subtitle={branchName ?? "Select a station"}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3 items-end">
          {!scope.isDealer && (
            <div className="space-y-1">
              <Label>Station</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select station" /></SelectTrigger>
                <SelectContent>{(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" /></div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <MetricCard title="Sales" value={usd(sales.usd)} icon={DollarSign} />
          <MetricCard title="PMS sold (USG)" value={n2(sales.PMS)} icon={Fuel} />
          <MetricCard title="AGO sold (USG)" value={n2(sales.AGO)} icon={Fuel} />
          <MetricCard title="Stock on hand (USG)" value={n2(totalStock)} subtitle={totalCap ? `${Math.round((totalStock / totalCap) * 100)}% of capacity` : undefined} icon={Droplets} />
          <MetricCard title="Latest net payroll" value={payroll ? usd(payroll.net) : "—"} subtitle={payroll ? `${MONTHS[payroll.month - 1]} ${payroll.year}` : "No runs yet"} icon={Wallet} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Droplets className="h-5 w-5 text-primary" /> Stock & Tank Dips</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tank</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Current</TableHead><TableHead className="text-right">Opening dip</TableHead>
                <TableHead className="text-right">Closing dip</TableHead><TableHead className="text-right">Deliveries</TableHead>
                <TableHead className="text-right">Tank sales</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dipRows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No tanks.</TableCell></TableRow>}
                {dipRows.map(({ t, opening, closing, del, tankSales }) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant="outline">{t.product_type}</Badge></TableCell>
                    <TableCell className="text-right">{n2(Number(t.capacity_usg))}</TableCell>
                    <TableCell className="text-right">{n2(Number(t.current_level_usg))}</TableCell>
                    <TableCell className="text-right">{opening == null ? "—" : n2(opening)}</TableCell>
                    <TableCell className="text-right">{closing == null ? "—" : n2(closing)}</TableCell>
                    <TableCell className="text-right">{n2(del)}</TableCell>
                    <TableCell className="text-right">{tankSales == null ? "—" : n2(tankSales)}</TableCell>
                    <TableCell>{t.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /> Meter Readings & Sales</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Shift</TableHead><TableHead>Pump</TableHead><TableHead>Attendant</TableHead>
                <TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Closing</TableHead>
                <TableHead className="text-right">RTT</TableHead><TableHead className="text-right">Sales (USG)</TableHead><TableHead className="text-right">Sales (USD)</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(meters ?? []).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No meter readings for this date.</TableCell></TableRow>}
                {(meters ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.shifts?.name}</TableCell>
                    <TableCell>{m.pumps?.name} <span className="text-muted-foreground text-xs">{m.pumps?.product_type}</span></TableCell>
                    <TableCell>{m.attendants?.full_name}</TableCell>
                    <TableCell className="text-right">{n2(Number(m.opening_meter))}</TableCell>
                    <TableCell className="text-right">{n2(Number(m.closing_meter))}</TableCell>
                    <TableCell className="text-right">{n2(Number(m.rtt_usg))}</TableCell>
                    <TableCell className="text-right">{n2(Number(m.sales_usg) || 0)}</TableCell>
                    <TableCell className="text-right">{usd(Number(m.total_sales_usd) || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Payroll Totals</CardTitle>
            {payroll && <Button asChild size="sm" variant="outline"><Link to={payrollRunLink(payroll)}>Open run</Link></Button>}
          </CardHeader>
          <CardContent>
            {!payroll ? <p className="text-sm text-muted-foreground">No payroll saved for this station yet.</p> : (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-5 text-sm">
                <div><p className="text-muted-foreground">Period</p><p className="font-semibold">{MONTHS[payroll.month - 1]} {payroll.year}</p></div>
                <div><p className="text-muted-foreground">Employees</p><p className="font-semibold">{payroll.employees}</p></div>
                <div><p className="text-muted-foreground">Gross</p><p className="font-semibold">{usd(payroll.gross)}</p></div>
                <div><p className="text-muted-foreground">Deductions</p><p className="font-semibold text-destructive">{usd(payroll.deductions)}</p></div>
                <div><p className="text-muted-foreground">Net pay</p><p className="font-semibold">{usd(payroll.net)}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

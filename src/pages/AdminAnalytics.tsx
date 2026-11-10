import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { DollarSign, Wallet, Truck, Fuel, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAll } from "@/lib/fetch-all";
import { allBuckets, bucketKey, bucketLabel, rangeFor, type Granularity } from "@/lib/analytics-buckets";

const C = { pms: "hsl(var(--primary))", ago: "hsl(var(--accent))", ok: "hsl(var(--success))", warn: "hsl(var(--warning))", bad: "hsl(var(--destructive))", muted: "hsl(var(--muted-foreground))" };
const PALETTE = [C.pms, C.ago, C.ok, C.warn, C.bad, C.muted];
const ANIM = { isAnimationActive: true, animationDuration: 900 };
const n0 = (n: number) => Math.round(n).toLocaleString();
const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const tip = { contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };
const axis = { tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" }, tickLine: false, axisLine: false };
const cashUsd = (c: any) => c.amount_usd != null ? Number(c.amount_usd) : c.deposit_type === "USD" ? Number(c.amount) || 0 : (Number(c.amount) || 0) / (Number(c.exchange_rate) || 1);

export default function AdminAnalytics() {
  const [g, setG] = useState<Granularity>("month");
  const [station, setStation] = useState("all");
  const { from, to } = rangeFor(g);
  const fromIso = format(from, "yyyy-MM-dd"), toIso = format(to, "yyyy-MM-dd");

  const { data: branches } = useQuery({
    queryKey: ["aa-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name, zone").eq("is_active", true).order("name");
      if (error) throw error; return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", station, fromIso, toIso],
    queryFn: async () => {
      const scoped = (q: any) => (station === "all" ? q : q.eq("branch_id", station));
      const [sales, cash, deliveries] = await Promise.all([
        fetchAll<any>((a, b) => scoped(supabase.from("shift_sales_reports").select("date, branch_id, sales_usg, total_sales_usd, pumps(product_type)")).gte("date", fromIso).lte("date", toIso).range(a, b)),
        fetchAll<any>((a, b) => scoped(supabase.from("cash_deposits").select("date, branch_id, amount, amount_usd, exchange_rate, deposit_type")).gte("date", fromIso).lte("date", toIso).range(a, b)),
        fetchAll<any>((a, b) => scoped(supabase.from("fuel_deliveries").select("delivery_date, branch_id, quantity_usg")).gte("delivery_date", fromIso).lte("delivery_date", toIso).range(a, b)),
      ]);
      return { sales, cash, deliveries };
    },
  });

  const a = useMemo(() => {
    if (!data || !branches) return null;
    const keys = allBuckets(g);
    const rows = Object.fromEntries(keys.map((k) => [k, { label: bucketLabel(g, k), revenue: 0, cash: 0, pms: 0, ago: 0, delivered: 0 }]));
    const st: Record<string, { id: string; name: string; zone: string | null; revenue: number; cash: number; volume: number; delivered: number }> = {};
    branches.forEach((b) => { if (station === "all" || b.id === station) st[b.id] = { id: b.id, name: b.name, zone: b.zone, revenue: 0, cash: 0, volume: 0, delivered: 0 }; });
    data.sales.forEach((s: any) => {
      const r = rows[bucketKey(g, s.date)]; if (!r) return;
      const usg = Number(s.sales_usg) || 0, $ = Number(s.total_sales_usd) || 0;
      r.revenue += $; if (s.pumps?.product_type === "AGO") r.ago += usg; else r.pms += usg;
      if (st[s.branch_id]) { st[s.branch_id].revenue += $; st[s.branch_id].volume += usg; }
    });
    data.cash.forEach((c: any) => {
      const r = rows[bucketKey(g, c.date)]; if (!r) return;
      const v = cashUsd(c); r.cash += v; if (st[c.branch_id]) st[c.branch_id].cash += v;
    });
    data.deliveries.forEach((d: any) => {
      const r = rows[bucketKey(g, d.delivery_date)]; if (!r) return;
      const q = Number(d.quantity_usg) || 0; r.delivered += q; if (st[d.branch_id]) st[d.branch_id].delivered += q;
    });
    const series = keys.map((k) => rows[k]);
    const stations = Object.values(st).sort((x, y) => y.revenue - x.revenue);
    const zones: Record<string, number> = {};
    stations.forEach((s) => { const z = s.zone ? s.zone[0].toUpperCase() + s.zone.slice(1) : "Unassigned"; zones[z] = (zones[z] ?? 0) + s.revenue; });
    const t = series.reduce((acc, r) => ({ revenue: acc.revenue + r.revenue, cash: acc.cash + r.cash, volume: acc.volume + r.pms + r.ago, delivered: acc.delivered + r.delivered }), { revenue: 0, cash: 0, volume: 0, delivered: 0 });
    return { series, stations, zones: Object.entries(zones).map(([name, value]) => ({ name, value: Math.round(value) })).filter((z) => z.value > 0), t };
  }, [data, branches, g, station]);

  return (
    <AppLayout title="Admin Analytics" subtitle="All stations by day, week, month and year">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-muted-foreground">{format(from, "MMM d, yyyy")} – {format(to, "MMM d, yyyy")}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs">Station</Label>
              <Select value={station} onValueChange={setStation}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stations</SelectItem>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={g} onValueChange={(v) => setG(v as Granularity)}>
              <TabsList className="grid w-full grid-cols-4 sm:w-auto stagger-grid">
                <TabsTrigger value="day">Day</TabsTrigger><TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger><TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {isLoading || !a ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger-grid">
              <MetricCard title="Total sales" value={usd(a.t.revenue)} icon={<DollarSign className="h-4 w-4" />} variant="primary" />
              <MetricCard title="Cash deposited" value={usd(a.t.cash)} subtitle={`Gap ${usd(a.t.revenue - a.t.cash)}`} icon={<Wallet className="h-4 w-4" />} />
              <MetricCard title="Volume sold" value={`${n0(a.t.volume)} USG`} icon={<Fuel className="h-4 w-4" />} variant="success" />
              <MetricCard title="Fuel received" value={`${n0(a.t.delivered)} USG`} icon={<Truck className="h-4 w-4" />} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 stagger-grid">
              <Chart title="Sales vs cash deposits" desc="USD">
                <ComposedChart data={a.series}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" {...axis} /><YAxis {...axis} width={55} />
                  <Tooltip {...tip} formatter={(v: number) => usd(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Sales" fill={C.pms} radius={[4, 4, 0, 0]} {...ANIM} />
                  <Bar dataKey="cash" name="Deposited" fill={C.ok} radius={[4, 4, 0, 0]} {...ANIM} />
                  <Line type="monotone" dataKey="delivered" name="Received (USG)" stroke={C.warn} dot={false} strokeWidth={2} {...ANIM} />
                </ComposedChart>
              </Chart>
              <Chart title="Volume sold by product" desc="USG">
                <AreaChart data={a.series}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" {...axis} /><YAxis {...axis} width={55} />
                  <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="pms" name="PMS" stackId="1" stroke={C.pms} fill={C.pms} fillOpacity={0.35} {...ANIM} />
                  <Area type="monotone" dataKey="ago" name="AGO" stackId="1" stroke={C.ago} fill={C.ago} fillOpacity={0.35} {...ANIM} />
                </AreaChart>
              </Chart>
              <Chart title="Sales by station" desc="Top 12 stations (USD)">
                <BarChart data={a.stations.slice(0, 12)} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" {...axis} width={90} />
                  <Tooltip {...tip} formatter={(v: number) => usd(v)} />
                  <Bar dataKey="revenue" name="Sales" fill={C.pms} radius={[0, 4, 4, 0]} {...ANIM} />
                </BarChart>
              </Chart>
              <Chart title="Sales by zone" desc="Share of USD sales">
                {a.zones.length ? (
                  <PieChart>
                    <Pie data={a.zones} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2} {...ANIM}>
                      {a.zones.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip {...tip} formatter={(v: number) => usd(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales in this period</div>}
              </Chart>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" /> Station totals</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Station</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">Gap</TableHead><TableHead className="text-right">Sold (USG)</TableHead><TableHead className="text-right">Received (USG)</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {a.stations.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium"><Link to="/station-analytics" className="hover:underline">{s.name}</Link></TableCell>
                        <TableCell className="text-right">{usd(s.revenue)}</TableCell>
                        <TableCell className="text-right">{usd(s.cash)}</TableCell>
                        <TableCell className={`text-right ${s.revenue - s.cash > 0.5 ? "text-destructive" : ""}`}>{usd(s.revenue - s.cash)}</TableCell>
                        <TableCell className="text-right">{n0(s.volume)}</TableCell>
                        <TableCell className="text-right">{n0(s.delivered)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total</TableCell><TableCell className="text-right">{usd(a.t.revenue)}</TableCell><TableCell className="text-right">{usd(a.t.cash)}</TableCell>
                      <TableCell className="text-right">{usd(a.t.revenue - a.t.cash)}</TableCell><TableCell className="text-right">{n0(a.t.volume)}</TableCell><TableCell className="text-right">{n0(a.t.delivered)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Chart({ title, desc, children }: { title: string; desc?: string; children: React.ReactElement }) {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle>{desc && <CardDescription className="text-xs">{desc}</CardDescription>}</CardHeader>
      <CardContent className="h-64 sm:h-72 px-2 sm:px-6"><ResponsiveContainer>{children}</ResponsiveContainer></CardContent>
    </Card>
  );
}

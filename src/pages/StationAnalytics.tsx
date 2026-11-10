import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Fuel, Truck, Gauge, DollarSign, Trophy, Droplets, Wallet, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAccessScope } from "@/hooks/useAccessScope";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { allBuckets, bucketKey, bucketLabel, rangeFor, tankDaySales, type Granularity } from "@/lib/analytics-buckets";

const C = {
  pms: "hsl(var(--primary))",
  ago: "hsl(var(--accent))",
  ok: "hsl(var(--success))",
  warn: "hsl(var(--warning))",
  bad: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
};
const PALETTE = [C.pms, C.ago, C.ok, C.warn, C.bad, C.muted];
const ANIM = { isAnimationActive: true, animationDuration: 900, animationEasing: "ease-out" as const };
const n0 = (n: number) => Math.round(n).toLocaleString();
const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const NONE = ["00000000-0000-0000-0000-000000000000"];

/** Page through results to avoid the 1000-row cap on long ranges. */
async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await build(i, i + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function ChartCard({ title, desc, children, className }: { title: string; desc?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`animate-fade-in ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {desc && <CardDescription className="text-xs">{desc}</CardDescription>}
      </CardHeader>
      <CardContent className="h-64 sm:h-72 px-2 sm:px-6">{children}</CardContent>
    </Card>
  );
}

const Empty = () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data for this period</div>;
const tip = { contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };
const axis = { tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" }, tickLine: false, axisLine: false };

export default function StationAnalytics() {
  const scope = useAccessScope();
  const [branchId, setBranchId] = useState("");
  const [g, setG] = useState<Granularity>("day");
  const { from, to } = rangeFor(g);
  const fromIso = format(from, "yyyy-MM-dd");
  const toIso = format(to, "yyyy-MM-dd");

  const { data: branches } = useQuery({
    queryKey: ["sa-branches", scope.allowedBranchIds?.join(",") ?? "all"],
    queryFn: async () => {
      let q = supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (scope.allowedBranchIds) q = q.in("id", scope.allowedBranchIds.length ? scope.allowedBranchIds : NONE);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (scope.defaultBranchId) setBranchId(scope.defaultBranchId);
    else if (!branchId && branches?.length) setBranchId(branches[0].id);
  }, [scope.defaultBranchId, branches, branchId]);

  const { data, isLoading } = useQuery({
    queryKey: ["station-analytics", branchId, fromIso, toIso],
    enabled: !!branchId,
    queryFn: async () => {
      const [tanks, pumps, dips, deliveries, sales, cash] = await Promise.all([
        fetchAll<any>((a, b) => supabase.from("tanks").select("id, name, product_type, capacity_usg, current_level_usg, threshold_usg, status, is_active").eq("branch_id", branchId).range(a, b)),
        fetchAll<any>((a, b) => supabase.from("pumps").select("id, name, product_type, is_active").eq("branch_id", branchId).range(a, b)),
        fetchAll<any>((a, b) => supabase.from("stock_readings").select("tank_id, date, physical_level_usg, theoretical_level_usg, created_at, shifts(name)").eq("branch_id", branchId).gte("date", fromIso).lte("date", toIso).order("created_at").range(a, b)),
        fetchAll<any>((a, b) => supabase.from("fuel_deliveries").select("tank_id, delivery_date, quantity_usg, supplier").eq("branch_id", branchId).gte("delivery_date", fromIso).lte("delivery_date", toIso).range(a, b)),
        fetchAll<any>((a, b) => supabase.from("shift_sales_reports").select("date, pump_id, attendant_id, opening_meter, closing_meter, sales_usg, total_sales_usd, shifts(name), attendants(full_name), pumps(name, product_type)").eq("branch_id", branchId).gte("date", fromIso).lte("date", toIso).range(a, b)),
        fetchAll<any>((a, b) => supabase.from("cash_deposits").select("date, amount, amount_usd, deposit_type, attendant_id, shifts(name), attendants(full_name)").eq("branch_id", branchId).gte("date", fromIso).lte("date", toIso).range(a, b)),
      ]);
      return { tanks, pumps, dips, deliveries, sales, cash };
    },
  });

  const a = useMemo(() => {
    if (!data) return null;
    const keys = allBuckets(g);
    const init = () => Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;
    const tankById = new Map(data.tanks.map((t: any) => [t.id, t]));
    const prodOf = (tankId: string) => (tankById.get(tankId) as any)?.product_type ?? "PMS";

    // Deliveries
    const delPms = init(), delAgo = init(), delCount = init();
    const bySupplier: Record<string, number> = {};
    const delByTank: Record<string, number> = {};
    const delTankDay: Record<string, number> = {};
    data.deliveries.forEach((d: any) => {
      const k = bucketKey(g, d.delivery_date); const q = Number(d.quantity_usg) || 0;
      if (!(k in delPms)) return;
      (prodOf(d.tank_id) === "AGO" ? delAgo : delPms)[k] += q; delCount[k] += 1;
      bySupplier[d.supplier || "Unknown"] = (bySupplier[d.supplier || "Unknown"] ?? 0) + q;
      delByTank[d.tank_id] = (delByTank[d.tank_id] ?? 0) + q;
      delTankDay[`${d.tank_id}|${d.delivery_date}`] = (delTankDay[`${d.tank_id}|${d.delivery_date}`] ?? 0) + q;
    });

    // Dips: opening/closing per tank-day, then tank sales
    const tankDay: Record<string, { tank: string; date: string; levels: number[]; theo: number[] }> = {};
    data.dips.forEach((r: any) => {
      const id = `${r.tank_id}|${r.date}`;
      (tankDay[id] ??= { tank: r.tank_id, date: r.date, levels: [], theo: [] });
      tankDay[id].levels.push(Number(r.physical_level_usg) || 0);
      tankDay[id].theo.push(Number(r.theoretical_level_usg) || 0);
    });
    const openB = init(), closeB = init(), physB = init(), theoB = init(), dipCount = init();
    const tSalesPms = init(), tSalesAgo = init();
    const tankSalesByTank: Record<string, number> = {};
    Object.values(tankDay).forEach((td) => {
      const k = bucketKey(g, td.date); if (!(k in openB)) return;
      openB[k] += td.levels[0]; closeB[k] += td.levels[td.levels.length - 1];
      physB[k] += td.levels.reduce((s, x) => s + x, 0); theoB[k] += td.theo.reduce((s, x) => s + x, 0);
      dipCount[k] += td.levels.length;
      const s = tankDaySales(td.levels, delTankDay[`${td.tank}|${td.date}`] ?? 0);
      (prodOf(td.tank) === "AGO" ? tSalesAgo : tSalesPms)[k] += s;
      tankSalesByTank[td.tank] = (tankSalesByTank[td.tank] ?? 0) + s;
    });

    // Meter / pump sales
    const mPms = init(), mAgo = init(), revenue = init(), readings = init();
    const pumpSales: Record<string, { name: string; usg: number; usd: number; product: string }> = {};
    const shiftSales: Record<string, number> = {};
    const attSales: Record<string, { name: string; usd: number; usg: number }> = {};
    const meterByProduct = { PMS: 0, AGO: 0 };
    data.sales.forEach((s: any) => {
      const k = bucketKey(g, s.date); if (!(k in mPms)) return;
      const usg = Number(s.sales_usg) || 0; const $ = Number(s.total_sales_usd) || 0;
      const prod = s.pumps?.product_type ?? "PMS";
      (prod === "AGO" ? mAgo : mPms)[k] += usg; revenue[k] += $; readings[k] += 1;
      meterByProduct[prod as "PMS" | "AGO"] += usg;
      const p = (pumpSales[s.pump_id] ??= { name: s.pumps?.name ?? "Pump", usg: 0, usd: 0, product: prod });
      p.usg += usg; p.usd += $;
      const sh = s.shifts?.name ?? "—"; shiftSales[sh] = (shiftSales[sh] ?? 0) + $;
      const at = (attSales[s.attendant_id] ??= { name: s.attendants?.full_name ?? "Unknown", usd: 0, usg: 0 });
      at.usd += $; at.usg += usg;
    });

    // Cash deposits
    const cashB = init();
    const cashShift: Record<string, number> = {};
    const cashAtt: Record<string, number> = {};
    data.cash.forEach((c: any) => {
      const k = bucketKey(g, c.date); if (!(k in cashB)) return;
      const v = c.amount_usd != null ? Number(c.amount_usd) : c.deposit_type === "USD" ? Number(c.amount) : 0;
      cashB[k] += v;
      const sh = c.shifts?.name ?? "—"; cashShift[sh] = (cashShift[sh] ?? 0) + v;
      if (c.attendant_id) cashAtt[c.attendant_id] = (cashAtt[c.attendant_id] ?? 0) + v;
    });

    const series = keys.map((k) => {
      const tPms = tSalesPms[k], tAgo = tSalesAgo[k];
      return {
        label: bucketLabel(g, k),
        delPms: delPms[k], delAgo: delAgo[k], delCount: delCount[k],
        opening: openB[k], closing: closeB[k], physical: physB[k], theoretical: theoB[k], dips: dipCount[k],
        tPms, tAgo, mPms: mPms[k], mAgo: mAgo[k], readings: readings[k], revenue: revenue[k], cash: cashB[k],
        gap: revenue[k] - cashB[k],
        variance: tPms + tAgo - (mPms[k] + mAgo[k]),
      };
    });

    const tankStatus = data.tanks.filter((t: any) => t.is_active).map((t: any, i: number) => ({
      name: t.name, product: t.product_type,
      fill: t.capacity_usg ? Math.round((Number(t.current_level_usg) / Number(t.capacity_usg)) * 100) : 0,
      color: t.product_type === "AGO" ? C.ago : C.pms, idx: i,
      level: Number(t.current_level_usg), capacity: Number(t.capacity_usg), status: t.status,
    }));

    const stockControl = data.tanks.filter((t: any) => t.is_active).map((t: any) => {
      const ts = tankSalesByTank[t.id] ?? 0;
      return { tank: t.name, tankSales: Math.round(ts), deliveries: Math.round(delByTank[t.id] ?? 0) };
    });

    const pumpMgmt = ["PMS", "AGO"].flatMap((p) => [
      { name: `${p} active`, value: data.pumps.filter((x: any) => x.product_type === p && x.is_active).length, color: p === "AGO" ? C.ago : C.pms },
      { name: `${p} inactive`, value: data.pumps.filter((x: any) => x.product_type === p && !x.is_active).length, color: C.muted },
    ]).filter((x) => x.value > 0);

    const attendants = Object.entries(attSales).map(([id, v]) => ({ ...v, cash: cashAtt[id] ?? 0 })).sort((x, y) => y.usd - x.usd);
    const shifts = Array.from(new Set([...Object.keys(shiftSales), ...Object.keys(cashShift)])).map((s) => ({ shift: s, sales: shiftSales[s] ?? 0, cash: cashShift[s] ?? 0 }));

    const sum = (f: (r: typeof series[number]) => number) => series.reduce((s, r) => s + f(r), 0);
    return {
      series, tankStatus, stockControl, pumpMgmt, attendants, shifts,
      suppliers: Object.entries(bySupplier).map(([name, value]) => ({ name, value: Math.round(value) })),
      pumps: Object.values(pumpSales).sort((x, y) => y.usg - x.usg),
      totals: {
        revenue: sum((r) => r.revenue), cash: sum((r) => r.cash), meter: sum((r) => r.mPms + r.mAgo),
        tank: sum((r) => r.tPms + r.tAgo), delivered: sum((r) => r.delPms + r.delAgo), variance: sum((r) => r.variance),
      },
      meterByProduct,
    };
  }, [data, g]);

  const top = a?.attendants[0];

  return (
    <AppLayout title="Station Analytics">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Station Analytics</h1>
            <p className="text-sm text-muted-foreground">Trends for {format(from, "MMM d, yyyy")} – {format(to, "MMM d, yyyy")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {!scope.isDealer && (
              <div className="space-y-1">
                <Label className="text-xs">Station</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Select station" /></SelectTrigger>
                  <SelectContent>{branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Tabs value={g} onValueChange={(v) => setG(v as Granularity)}>
              <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {(isLoading || !a) ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard title="Sales revenue" value={usd(a.totals.revenue)} icon={<DollarSign className="h-4 w-4" />} variant="primary" />
              <MetricCard title="Cash deposited" value={usd(a.totals.cash)} subtitle={`Gap ${usd(a.totals.revenue - a.totals.cash)}`} icon={<Wallet className="h-4 w-4" />} />
              <MetricCard title="Fuel received" value={`${n0(a.totals.delivered)} USG`} icon={<Truck className="h-4 w-4" />} variant="success" />
              <MetricCard title="Stock variance" value={`${n0(a.totals.variance)} USG`} subtitle="Tank sales − meter sales" icon={<AlertTriangle className="h-4 w-4" />} variant={Math.abs(a.totals.variance) > a.totals.meter * 0.02 ? "danger" : "default"} />
            </div>

            <Section title="Tanks & Stock">
              <ChartCard title="Tank management" desc="Current fill level of each active tank">
                {a.tankStatus.length ? (
                  <ResponsiveContainer>
                    <RadialBarChart innerRadius="20%" outerRadius="100%" data={a.tankStatus.map((t) => ({ ...t, fill: t.color, pct: t.fill }))} startAngle={180} endAngle={-180}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="pct" background cornerRadius={6} {...ANIM} />
                      <Legend iconSize={8} formatter={(_v, e: any) => `${e.payload.name} ${e.payload.pct}%`} wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip {...tip} formatter={(v: number, _n, p: any) => [`${v}% · ${n0(p.payload.level)}/${n0(p.payload.capacity)} USG`, p.payload.name]} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </ChartCard>
              <ChartCard title="Shift opening & closing dips" desc="Total opening vs closing dip (USG)">
                <ResponsiveContainer>
                  <BarChart data={a.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis {...axis} width={50} />
                    <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="opening" name="Opening" fill={C.pms} radius={[4, 4, 0, 0]} {...ANIM} />
                    <Bar dataKey="closing" name="Closing" fill={C.ago} radius={[4, 4, 0, 0]} {...ANIM} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Tank dipping" desc="Physical vs book level and number of dips">
                <ResponsiveContainer>
                  <ComposedChart data={a.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis yAxisId="l" {...axis} width={50} /><YAxis yAxisId="r" orientation="right" {...axis} width={30} />
                    <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="r" dataKey="dips" name="Dips taken" fill={C.muted} opacity={0.35} {...ANIM} />
                    <Line yAxisId="l" type="monotone" dataKey="physical" name="Physical" stroke={C.pms} strokeWidth={2} dot={false} {...ANIM} />
                    <Line yAxisId="l" type="monotone" dataKey="theoretical" name="Book" stroke={C.ago} strokeDasharray="5 4" strokeWidth={2} dot={false} {...ANIM} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Tank sales" desc="Opening − closing + deliveries (USG)">
                <ResponsiveContainer>
                  <AreaChart data={a.series}>
                    <defs>
                      <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.pms} stopOpacity={0.5} /><stop offset="95%" stopColor={C.pms} stopOpacity={0} /></linearGradient>
                      <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.ago} stopOpacity={0.5} /><stop offset="95%" stopColor={C.ago} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis {...axis} width={50} />
                    <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="tPms" name="PMS" stackId="1" stroke={C.pms} fill="url(#gP)" {...ANIM} />
                    <Area type="monotone" dataKey="tAgo" name="AGO" stackId="1" stroke={C.ago} fill="url(#gA)" {...ANIM} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Shift stock report" desc="Variance = tank sales − meter sales (USG)">
                <ResponsiveContainer>
                  <BarChart data={a.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis {...axis} width={50} />
                    <Tooltip {...tip} /><ReferenceLine y={0} stroke={C.muted} />
                    <Bar dataKey="variance" name="Variance" radius={[4, 4, 4, 4]} {...ANIM}>
                      {a.series.map((r, i) => <Cell key={i} fill={r.variance >= 0 ? C.ok : C.bad} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Stock control" desc="Per-tank sales vs deliveries in period">
                {a.stockControl.length ? (
                  <ResponsiveContainer>
                    <RadarChart data={a.stockControl} outerRadius="70%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="tank" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar dataKey="tankSales" name="Tank sales" stroke={C.pms} fill={C.pms} fillOpacity={0.35} {...ANIM} />
                      <Radar dataKey="deliveries" name="Deliveries" stroke={C.ok} fill={C.ok} fillOpacity={0.25} {...ANIM} />
                      <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip {...tip} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </ChartCard>
            </Section>

            <Section title="Product reception & deliveries">
              <ChartCard title="Product reception" desc="Volume received by product (USG)">
                <ResponsiveContainer>
                  <BarChart data={a.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis {...axis} width={50} />
                    <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="delPms" name="PMS" stackId="d" fill={C.pms} {...ANIM} />
                    <Bar dataKey="delAgo" name="AGO" stackId="d" fill={C.ago} radius={[4, 4, 0, 0]} {...ANIM} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Deliveries by supplier" desc="Share of volume received">
                {a.suppliers.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={a.suppliers} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2} {...ANIM}>
                        {a.suppliers.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip {...tip} formatter={(v: number) => `${n0(v)} USG`} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </ChartCard>
              <ChartCard title="Delivery frequency" desc="Number of deliveries received">
                <ResponsiveContainer>
                  <LineChart data={a.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis allowDecimals={false} {...axis} width={30} />
                    <Tooltip {...tip} />
                    <Line type="stepAfter" dataKey="delCount" name="Deliveries" stroke={C.ok} strokeWidth={2} {...ANIM} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </Section>

            <Section title="Pumps & meter readings">
              <ChartCard title="Pump sales" desc="Volume sold per pump (USG)">
                {a.pumps.length ? (
                  <ResponsiveContainer>
                    <BarChart data={a.pumps} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" {...axis} width={70} />
                      <Tooltip {...tip} formatter={(v: number) => `${n0(v)} USG`} />
                      <Bar dataKey="usg" name="Sold" radius={[0, 4, 4, 0]} {...ANIM}>
                        {a.pumps.map((p, i) => <Cell key={i} fill={p.product === "AGO" ? C.ago : C.pms} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </ChartCard>
              <ChartCard title="Pump management" desc="Pumps by product and status">
                {a.pumpMgmt.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={a.pumpMgmt} dataKey="value" nameKey="name" outerRadius="80%" label={{ fontSize: 11 }} {...ANIM}>
                        {a.pumpMgmt.map((p, i) => <Cell key={i} fill={p.color} />)}
                      </Pie>
                      <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </ChartCard>
              <ChartCard title="Meter readings" desc="Meter sales volume and readings recorded">
                <ResponsiveContainer>
                  <ComposedChart data={a.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis yAxisId="l" {...axis} width={50} /><YAxis yAxisId="r" orientation="right" allowDecimals={false} {...axis} width={30} />
                    <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="l" dataKey="mPms" name="PMS USG" stackId="m" fill={C.pms} {...ANIM} />
                    <Bar yAxisId="l" dataKey="mAgo" name="AGO USG" stackId="m" fill={C.ago} {...ANIM} />
                    <Line yAxisId="r" type="monotone" dataKey="readings" name="Readings" stroke={C.ok} strokeWidth={2} dot={false} {...ANIM} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </Section>

            <Section title="Sales, cash & attendants">
              <ChartCard title="Sales entry vs cash deposits" desc="Revenue recorded vs cash deposited (USD)">
                <ResponsiveContainer>
                  <ComposedChart data={a.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axis} /><YAxis {...axis} width={55} />
                    <Tooltip {...tip} formatter={(v: number) => usd(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" name="Sales" fill={C.pms} radius={[4, 4, 0, 0]} {...ANIM} />
                    <Bar dataKey="cash" name="Deposited" fill={C.ok} radius={[4, 4, 0, 0]} {...ANIM} />
                    <Line type="monotone" dataKey="gap" name="Shortfall" stroke={C.bad} strokeWidth={2} dot={false} {...ANIM} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Cash report per shift" desc="Sales and deposits per shift (USD)">
                {a.shifts.length ? (
                  <ResponsiveContainer>
                    <BarChart data={a.shifts}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="shift" {...axis} /><YAxis {...axis} width={55} />
                      <Tooltip {...tip} formatter={(v: number) => usd(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sales" name="Sales" fill={C.pms} radius={[4, 4, 0, 0]} {...ANIM} />
                      <Bar dataKey="cash" name="Deposited" fill={C.ok} radius={[4, 4, 0, 0]} {...ANIM} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </ChartCard>
              <ChartCard title="Cash report by attendant" desc="Sales vs cash deposited (USD)">
                {a.attendants.length ? (
                  <ResponsiveContainer>
                    <BarChart data={a.attendants.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" {...axis} width={90} />
                      <Tooltip {...tip} formatter={(v: number) => usd(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="usd" name="Sales" fill={C.pms} radius={[0, 4, 4, 0]} {...ANIM} />
                      <Bar dataKey="cash" name="Deposited" fill={C.ok} radius={[0, 4, 4, 0]} {...ANIM} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty />}
              </ChartCard>
              <Card className="animate-fade-in">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-warning" /> Top attendants</CardTitle>
                  <CardDescription className="text-xs">Ranked by sales in the period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {top ? (
                    <>
                      <div className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Highest sales</p>
                        <p className="text-lg font-semibold">{top.name}</p>
                        <p className="text-sm">{usd(top.usd)} · {n0(top.usg)} USG</p>
                      </div>
                      {a.attendants.slice(0, 5).map((at, i) => {
                        const pct = top.usd ? (at.usd / top.usd) * 100 : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm"><span className="truncate">{i + 1}. {at.name}</span><span className="font-medium">{usd(at.usd)}</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : <p className="text-sm text-muted-foreground">No sales recorded</p>}
                </CardContent>
              </Card>
            </Section>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="gap-1"><Fuel className="h-3 w-3" /> PMS meter {n0(a.meterByProduct.PMS)} USG</Badge>
              <Badge variant="outline" className="gap-1"><Droplets className="h-3 w-3" /> AGO meter {n0(a.meterByProduct.AGO)} USG</Badge>
              <Badge variant="outline" className="gap-1"><Gauge className="h-3 w-3" /> Tank sales {n0(a.totals.tank)} USG</Badge>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

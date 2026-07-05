import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell,
} from "recharts";
import { Droplet, TrendingUp, Download, Printer, AlertTriangle, FileSpreadsheet } from "lucide-react";

// Outlier rule: |variance| > 2% of |tankSales| (min floor 25 USG to ignore tiny values)
const OUTLIER_PCT = 0.02;
const OUTLIER_FLOOR = 25;
function isOutlier(variance: number, tankSales: number) {
  const bound = Math.max(OUTLIER_FLOOR, Math.abs(tankSales) * OUTLIER_PCT);
  return Math.abs(variance) > bound;
}

interface Props {
  branchId: string;
  branchName?: string;
  endDate: string;      // yyyy-MM-dd
  days?: number;
  shiftId?: string;     // when set, "today" metrics are scoped to this shift only
  shiftName?: string;
}

interface ShiftBreakdown {
  shiftId: string;
  shiftName: string;
  opening: number;
  closing: number;
  deliveries: number;
  tankSales: number;
  meterSales: number;
  variance: number;
}

/**
 * Daily Tank Dipping stats card — correlates tanks, stock_readings, fuel_deliveries,
 * shift_sales_reports and tank_pump_assignments. Uses the exact same
 * branch/date/shift filters as Tank Dipping, Meter Readings and Deliveries.
 */
export function DailyTankDippingCard({
  branchId, branchName, endDate, days = 7, shiftId, shiftName,
}: Props) {
  const end = parseISO(endDate);
  const start = subDays(end, days - 1);
  const startStr = format(start, "yyyy-MM-dd");
  const priorStr = format(subDays(start, 1), "yyyy-MM-dd");
  const printRef = useRef<HTMLDivElement>(null);
  const [drilldownTankId, setDrilldownTankId] = useState<string | null>(null);

  const { data: shifts } = useQuery({
    queryKey: ["shifts-daily-dip"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: tanks } = useQuery({
    queryKey: ["tanks-daily-dip", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks").select("*")
        .eq("branch_id", branchId).eq("is_active", true)
        .order("product_type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["tank-pump-daily-dip", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tank_pump_assignments").select("tank_id, pump_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: readings } = useQuery({
    queryKey: ["readings-daily-dip", branchId, priorStr, endDate],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_readings").select("*")
        .eq("branch_id", branchId)
        .gte("date", priorStr).lte("date", endDate)
        .order("date");
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveries } = useQuery({
    queryKey: ["deliveries-daily-dip", branchId, startStr, endDate],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_deliveries").select("tank_id, quantity_usg, delivery_date")
        .eq("branch_id", branchId)
        .gte("delivery_date", startStr).lte("delivery_date", endDate);
      if (error) throw error;
      return data;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["sales-daily-dip", branchId, startStr, endDate],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_sales_reports")
        .select("pump_id, shift_id, date, opening_meter, closing_meter, rtt_usg")
        .eq("branch_id", branchId)
        .gte("date", startStr).lte("date", endDate);
      if (error) throw error;
      return data;
    },
  });

  const dateList = useMemo(
    () => eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startStr, endDate]
  );

  const shiftOrder = useMemo(() => shifts?.map((s) => s.id) ?? [], [shifts]);
  const shiftNameById = useMemo(() => {
    const m: Record<string, string> = {};
    shifts?.forEach((s) => { m[s.id] = s.name; });
    return m;
  }, [shifts]);

  const perTankDaily = useMemo(() => {
    if (!tanks || !shifts) return [];
    const pumpsByTank: Record<string, string[]> = {};
    (assignments ?? []).forEach((a) => {
      pumpsByTank[a.tank_id] = pumpsByTank[a.tank_id] ?? [];
      pumpsByTank[a.tank_id].push(a.pump_id);
    });

    return tanks.map((tank) => {
      const tankReadings = (readings ?? []).filter((r) => r.tank_id === tank.id);
      const tankPumps = pumpsByTank[tank.id] ?? [];

      const daily = dateList.map((d) => {
        const dayReadings = tankReadings
          .filter((r) => r.date === d)
          .sort((a, b) => shiftOrder.indexOf(a.shift_id) - shiftOrder.indexOf(b.shift_id));

        // Full-day roll-up
        const first = dayReadings[0];
        const last = dayReadings[dayReadings.length - 1];
        let openingDay = first ? Number(first.theoretical_level_usg ?? 0) : 0;
        if (!openingDay) {
          const prev = tankReadings.filter((r) => r.date < d).sort((a, b) => b.date.localeCompare(a.date))[0];
          openingDay = prev ? Number(prev.physical_level_usg ?? 0) : 0;
        }
        const closingDay = last ? Number(last.physical_level_usg ?? 0) : openingDay;
        const dayDeliveries = (deliveries ?? [])
          .filter((x) => x.tank_id === tank.id && x.delivery_date === d)
          .reduce((s, x) => s + Number(x.quantity_usg ?? 0), 0);
        const meterSalesDay = (sales ?? [])
          .filter((s) => s.date === d && tankPumps.includes(s.pump_id))
          .reduce((sum, s) => sum + (Number(s.closing_meter ?? 0) - Number(s.opening_meter ?? 0) - Number(s.rtt_usg ?? 0)), 0);
        const tankSalesDay = openingDay - closingDay + dayDeliveries;
        const varianceDay = tankSalesDay - meterSalesDay;

        // Per-shift breakdown for drilldown
        const shiftBreakdown: ShiftBreakdown[] = (shifts ?? []).map((sh) => {
          const rdg = dayReadings.find((r) => r.shift_id === sh.id);
          const opening = rdg ? Number(rdg.theoretical_level_usg ?? 0) : 0;
          const closing = rdg ? Number(rdg.physical_level_usg ?? 0) : 0;
          const meterSales = (sales ?? [])
            .filter((s) => s.date === d && s.shift_id === sh.id && tankPumps.includes(s.pump_id))
            .reduce((sum, s) => sum + (Number(s.closing_meter ?? 0) - Number(s.opening_meter ?? 0) - Number(s.rtt_usg ?? 0)), 0);
          const tankSales = opening && closing ? opening - closing : 0;
          return {
            shiftId: sh.id, shiftName: sh.name,
            opening, closing, deliveries: 0,
            tankSales, meterSales, variance: tankSales - meterSales,
          };
        });

        return {
          date: d,
          opening: openingDay, closing: closingDay,
          deliveries: dayDeliveries, tankSales: tankSalesDay,
          meterSales: meterSalesDay, variance: varianceDay,
          shiftBreakdown,
        };
      });

      // "Today" — if a shift filter is active, scope to that shift only
      const dayEntry = daily[daily.length - 1];
      const today = shiftId
        ? (() => {
            const shift = dayEntry.shiftBreakdown.find((s) => s.shiftId === shiftId);
            return shift
              ? { ...shift, deliveries: dayEntry.deliveries, date: dayEntry.date }
              : { ...dayEntry };
          })()
        : dayEntry;

      return { tank, daily, today };
    });
  }, [tanks, shifts, assignments, readings, deliveries, sales, dateList, shiftOrder, shiftId]);

  // Split chart data by product
  const buildChart = (product: "PMS" | "AGO") =>
    dateList.map((d) => {
      const row: Record<string, number | string> = { date: format(parseISO(d), "MMM dd") };
      let sales = 0, variance = 0, closing = 0;
      perTankDaily.forEach(({ tank, daily }) => {
        if (tank.product_type !== product) return;
        const day = daily.find((x) => x.date === d);
        if (!day) return;
        sales += Math.max(0, day.tankSales);
        variance += day.variance;
        closing += day.closing;
      });
      row.Sales = Math.round(sales);
      row.Variance = Math.round(variance);
      row.ClosingDip = Math.round(closing);
      return row;
    });
  const pmsChart = useMemo(() => buildChart("PMS"), [perTankDaily, dateList]);
  const agoChart = useMemo(() => buildChart("AGO"), [perTankDaily, dateList]);

  const drilldown = perTankDaily.find((p) => p.tank.id === drilldownTankId);
  const drilldownToday = drilldown?.daily[drilldown.daily.length - 1];

  // --- Exports ---------------------------------------------------------------
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const meta = [
      ["Report", "Daily Tank Dipping — Auto Stats"],
      ["Branch", branchName ?? ""],
      ["Date range", `${startStr} → ${endDate}`],
      ["Shift filter", shiftName ?? "All shifts"],
      ["Generated", new Date().toLocaleString()],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Overview");

    // Per-tank table (today)
    const tankRows = [
      ["Tank","Product","Capacity (USG)","Opening Dip","Closing Dip","Deliveries","Tank Sales","Meter Sales","Variance","Outlier"],
      ...perTankDaily.map(({ tank, today }) => [
        tank.name, tank.product_type, Number(tank.capacity_usg),
        today.opening, today.closing, today.deliveries,
        today.tankSales, today.meterSales, today.variance,
        isOutlier(today.variance, today.tankSales) ? "YES" : "",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tankRows), "Tanks (Today)");

    // 7-day trend per tank
    const trendRows: (string | number)[][] = [["Tank","Product","Date","Opening","Closing","Deliveries","Tank Sales","Meter Sales","Variance","Outlier"]];
    perTankDaily.forEach(({ tank, daily }) => {
      daily.forEach((d) => trendRows.push([
        tank.name, tank.product_type, d.date,
        d.opening, d.closing, d.deliveries,
        d.tankSales, d.meterSales, d.variance,
        isOutlier(d.variance, d.tankSales) ? "YES" : "",
      ]));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendRows), "7-Day Trend");

    // Per-shift breakdown (today)
    const shiftRows: (string | number)[][] = [["Tank","Product","Shift","Opening","Closing","Tank Sales","Meter Sales","Variance"]];
    perTankDaily.forEach(({ tank, daily }) => {
      const dayEntry = daily[daily.length - 1];
      dayEntry.shiftBreakdown.forEach((s) => shiftRows.push([
        tank.name, tank.product_type, s.shiftName,
        s.opening, s.closing, s.tankSales, s.meterSales, s.variance,
      ]));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(shiftRows), "Per-Shift (Today)");

    // Chart data
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pmsChart), "PMS Chart");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agoChart), "AGO Chart");

    const suffix = shiftName ? `-${shiftName}` : "";
    XLSX.writeFile(wb, `daily-tank-dipping-${endDate}${suffix}.xlsx`);
  }

  function exportPDF() {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow popups to export PDF"); return; }
    win.document.write(`<html><head><title>Daily Tank Dipping — ${branchName ?? ""}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
        h1{font-size:20px;margin:0 0 4px;color:#1e40af}
        .sub{color:#64748b;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
        th,td{padding:6px 8px;border:1px solid #e2e8f0;text-align:right}
        th{background:#f1f5f9;text-align:left;text-transform:uppercase;font-size:10px;color:#334155}
        td:first-child,th:first-child{text-align:left}
        .outlier{background:#fef2f2;color:#b91c1c;font-weight:600}
        svg{max-width:100%}
        .charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
        .chart{border:1px solid #e2e8f0;border-radius:8px;padding:12px}
        .chart h3{margin:0 0 8px;font-size:12px;color:#334155}
      </style></head><body>
      <h1>Daily Tank Dipping — Auto Stats</h1>
      <div class="sub">${branchName ?? ""} · ${startStr} → ${endDate}${shiftName ? ` · ${shiftName} Shift` : ""}</div>
      ${el.innerHTML}
      <script>setTimeout(()=>{window.print();},400);</script>
      </body></html>`);
    win.document.close();
  }

  if (!branchId) return null;

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplet className="h-4 w-4 text-primary" />
              Daily Tank Dipping — Auto Stats
              {branchName && <span className="text-muted-foreground font-normal">· {branchName}</span>}
              {shiftName && <Badge variant="secondary" className="ml-1">{shiftName} shift</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" /> Last {days} days
              </Badge>
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <Printer className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={printRef} className="space-y-6">
            {/* Per-tank table for the selected date/shift */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tank</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Capacity (USG)</TableHead>
                    <TableHead className="text-right">Opening Dip</TableHead>
                    <TableHead className="text-right">Closing Dip</TableHead>
                    <TableHead className="text-right">Deliveries</TableHead>
                    <TableHead className="text-right">Sales (USG)</TableHead>
                    <TableHead className="text-right">Meter Sales</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="w-32">{days}-day trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perTankDaily.map(({ tank, daily, today }) => {
                    const outlier = isOutlier(today.variance, today.tankSales);
                    return (
                      <TableRow
                        key={tank.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          outlier && "bg-destructive/5 outlier"
                        )}
                        onClick={() => setDrilldownTankId(tank.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {tank.name}
                            {outlier && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Outlier" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            tank.product_type === "PMS"
                              ? "border-fuel-pms text-fuel-pms bg-fuel-pms/10"
                              : "border-fuel-ago text-fuel-ago bg-fuel-ago/10"
                          )}>{tank.product_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{Number(tank.capacity_usg).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{today.opening.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{today.closing.toLocaleString()}</TableCell>
                        <TableCell className={cn("text-right", today.deliveries > 0 ? "text-primary font-medium" : "text-muted-foreground")}>
                          {today.deliveries > 0 ? `+${today.deliveries.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">{today.tankSales.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{today.meterSales.toLocaleString()}</TableCell>
                        <TableCell className={cn("text-right font-bold", outlier ? "text-destructive" : Math.abs(today.variance) < 1 ? "text-success" : "text-warning")}>
                          {today.variance >= 0 ? "+" : ""}{today.variance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <ResponsiveContainer width="100%" height={40}>
                            <LineChart data={daily.map((d) => ({ v: d.tankSales }))}>
                              <Line
                                type="monotone" dataKey="v"
                                stroke={tank.product_type === "PMS" ? "hsl(var(--fuel-pms))" : "hsl(var(--fuel-ago))"}
                                strokeWidth={2} dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {perTankDaily.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No tanks configured for this branch</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2">
                Click any row for a per-shift drilldown. Outliers = |variance| &gt; {(OUTLIER_PCT * 100).toFixed(0)}% of tank sales (min {OUTLIER_FLOOR} USG).
              </p>
            </div>

            {/* Split PMS vs AGO histograms with outlier bars */}
            <div className="charts grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ProductChart title="PMS — Daily Tank Sales & Variance" data={pmsChart} product="PMS" />
              <ProductChart title="AGO — Daily Tank Sales & Variance" data={agoChart} product="AGO" />
            </div>

            <div className="rounded-lg border border-border/50 p-4 chart">
              <p className="text-sm font-medium mb-3">Closing Dip Trend — All Tanks (USG)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={pmsChart.map((r, i) => ({
                  date: r.date,
                  PMS: r.ClosingDip as number,
                  AGO: agoChart[i]?.ClosingDip as number,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Legend />
                  <Line type="monotone" dataKey="PMS" stroke="hsl(var(--fuel-pms))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="AGO" stroke="hsl(var(--fuel-ago))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drilldown dialog */}
      <Dialog open={!!drilldownTankId} onOpenChange={(o) => !o && setDrilldownTankId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplet className="h-4 w-4 text-primary" />
              {drilldown?.tank.name} · {drilldown?.tank.product_type}
            </DialogTitle>
            <DialogDescription>
              Per-shift breakdown for {format(parseISO(endDate), "MMMM dd, yyyy")} · {branchName}
            </DialogDescription>
          </DialogHeader>
          {drilldown && drilldownToday && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <StatBox label="Opening Dip" value={`${drilldownToday.opening.toLocaleString()} USG`} />
                <StatBox label="Closing Dip" value={`${drilldownToday.closing.toLocaleString()} USG`} />
                <StatBox label="Deliveries" value={`+${drilldownToday.deliveries.toLocaleString()} USG`} />
                <StatBox
                  label="Day Variance"
                  value={`${drilldownToday.variance >= 0 ? "+" : ""}${drilldownToday.variance.toLocaleString()} USG`}
                  danger={isOutlier(drilldownToday.variance, drilldownToday.tankSales)}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Tank Sales</TableHead>
                    <TableHead className="text-right">Meter Sales</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownToday.shiftBreakdown.map((s) => {
                    const flag = isOutlier(s.variance, s.tankSales);
                    return (
                      <TableRow key={s.shiftId} className={cn(flag && "bg-destructive/5")}>
                        <TableCell className="font-medium">{s.shiftName}</TableCell>
                        <TableCell className="text-right">{s.opening.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{s.closing.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{s.tankSales.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{s.meterSales.toLocaleString()}</TableCell>
                        <TableCell className={cn("text-right font-bold", flag ? "text-destructive" : "text-muted-foreground")}>
                          {s.variance >= 0 ? "+" : ""}{s.variance.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductChart({ title, data, product }: { title: string; data: any[]; product: "PMS" | "AGO" }) {
  const color = product === "PMS" ? "hsl(var(--fuel-pms))" : "hsl(var(--fuel-ago))";
  return (
    <div className="rounded-lg border border-border/50 p-4 chart">
      <p className="text-sm font-medium mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Legend />
          <Bar dataKey="Sales" fill={color} radius={[4, 4, 0, 0]}>
            {data.map((row, i) => {
              const outlier = isOutlier(Number(row.Variance ?? 0), Number(row.Sales ?? 0));
              return <Cell key={i} fill={outlier ? "hsl(var(--destructive))" : color} />;
            })}
          </Bar>
          <Bar dataKey="Variance" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={cn("rounded-md border p-3", danger ? "border-destructive/40 bg-destructive/5" : "border-border/50 bg-muted/30")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold mt-0.5", danger && "text-destructive")}>{value}</div>
    </div>
  );
}

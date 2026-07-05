import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { Droplet, TrendingUp } from "lucide-react";

interface Props {
  branchId: string;
  branchName?: string;
  endDate: string; // yyyy-MM-dd
  days?: number;
}

/**
 * Daily Tank Dipping stats card.
 * Correlates data from: tanks, stock_readings, fuel_deliveries,
 * shift_sales_reports, tank_pump_assignments across the shift day.
 * For each tank per day:
 *   Opening Dip  = first shift theoretical_level_usg (fallback: previous day closing)
 *   Closing Dip  = last shift physical_level_usg
 *   Sales (USG)  = Opening − Closing + Deliveries
 *   Meter Sales  = Σ (closing_meter − opening_meter − rtt) for pumps mapped to tank
 *   Variance     = Sales − Meter Sales
 */
export function DailyTankDippingCard({ branchId, branchName, endDate, days = 7 }: Props) {
  const end = parseISO(endDate);
  const start = subDays(end, days - 1);
  const startStr = format(start, "yyyy-MM-dd");
  const priorStr = format(subDays(start, 1), "yyyy-MM-dd");

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
        .select("pump_id, date, opening_meter, closing_meter, rtt_usg")
        .eq("branch_id", branchId)
        .gte("date", startStr).lte("date", endDate);
      if (error) throw error;
      return data;
    },
  });

  const dateList = useMemo(
    () => eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd")),
    [startStr, endDate]
  );

  // Ordered shift ids (start → end of day)
  const shiftOrder = useMemo(() => shifts?.map((s) => s.id) ?? [], [shifts]);

  // Compute per-tank per-day metrics
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
        const first = dayReadings[0];
        const last = dayReadings[dayReadings.length - 1];

        // fallback opening = previous day's last closing
        let opening = first ? Number(first.theoretical_level_usg ?? 0) : 0;
        if (!opening) {
          const prev = tankReadings.filter((r) => r.date < d).sort((a, b) => b.date.localeCompare(a.date))[0];
          opening = prev ? Number(prev.physical_level_usg ?? 0) : 0;
        }
        const closing = last ? Number(last.physical_level_usg ?? 0) : opening;

        const dayDeliveries = (deliveries ?? [])
          .filter((x) => x.tank_id === tank.id && x.delivery_date === d)
          .reduce((s, x) => s + Number(x.quantity_usg ?? 0), 0);

        const meterSales = (sales ?? [])
          .filter((s) => s.date === d && tankPumps.includes(s.pump_id))
          .reduce((sum, s) => sum + (Number(s.closing_meter ?? 0) - Number(s.opening_meter ?? 0) - Number(s.rtt_usg ?? 0)), 0);

        const tankSales = opening - closing + dayDeliveries;
        const variance = tankSales - meterSales;

        return { date: d, opening, closing, deliveries: dayDeliveries, tankSales, meterSales, variance };
      });

      const today = daily[daily.length - 1];
      return { tank, daily, today };
    });
  }, [tanks, shifts, assignments, readings, deliveries, sales, dateList, shiftOrder]);

  // Chart data — daily total sales by product
  const chartData = useMemo(() => {
    return dateList.map((d) => {
      const row: Record<string, number | string> = { date: format(parseISO(d), "MMM dd") };
      let pms = 0, ago = 0, closingTotal = 0;
      perTankDaily.forEach(({ tank, daily }) => {
        const day = daily.find((x) => x.date === d);
        if (!day) return;
        if (tank.product_type === "PMS") pms += Math.max(0, day.tankSales);
        else if (tank.product_type === "AGO") ago += Math.max(0, day.tankSales);
        closingTotal += day.closing;
      });
      row.PMS = Math.round(pms);
      row.AGO = Math.round(ago);
      row.ClosingDip = Math.round(closingTotal);
      return row;
    });
  }, [perTankDaily, dateList]);

  if (!branchId) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Droplet className="h-4 w-4 text-primary" />
            Daily Tank Dipping — Auto Stats
            {branchName && <span className="text-muted-foreground font-normal">· {branchName}</span>}
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <TrendingUp className="h-3 w-3" /> Last {days} days
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Per-tank table for the selected end date */}
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
              {perTankDaily.map(({ tank, daily, today }) => (
                <TableRow key={tank.id}>
                  <TableCell className="font-medium">{tank.name}</TableCell>
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
                  <TableCell className={cn("text-right font-bold", Math.abs(today.variance) < 1 ? "text-success" : "text-destructive")}>
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
              ))}
              {perTankDaily.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No tanks configured for this branch</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Daily sales bar chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border/50 p-4">
            <p className="text-sm font-medium mb-3">Daily Tank Sales by Product (USG)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="PMS" fill="hsl(var(--fuel-pms))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="AGO" fill="hsl(var(--fuel-ago))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg border border-border/50 p-4">
            <p className="text-sm font-medium mb-3">Closing Dip Trend — All Tanks (USG)</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="ClosingDip" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

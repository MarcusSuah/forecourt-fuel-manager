import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Fuel, DollarSign, Users, Building2, BarChart3, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";

const volumeConfig = {
  pms: { label: "PMS", color: "hsl(var(--primary))" },
  ago: { label: "AGO", color: "hsl(var(--accent))" },
};

const revenueConfig = {
  revenue: { label: "Revenue ($)", color: "hsl(var(--primary))" },
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

export default function Analytics() {
  const [period, setPeriod] = useState("7");
  const dateFrom = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");
  const prevFrom = format(subDays(new Date(), parseInt(period) * 2), "yyyy-MM-dd");

  const { data: salesData } = useQuery({
    queryKey: ["analytics-sales", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_sales_reports")
        .select("date, branch_id, sales_usg, total_sales_usd, pumps(product_type), branches(name), attendants(full_name)")
        .gte("date", dateFrom).lte("date", dateTo);
      if (error) throw error;
      return data;
    },
  });

  const { data: prevSalesData } = useQuery({
    queryKey: ["analytics-prev-sales", prevFrom, dateFrom],
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_sales_reports")
        .select("sales_usg, total_sales_usd")
        .gte("date", prevFrom).lt("date", dateFrom);
      if (error) throw error;
      return data;
    },
  });

  const { data: cashData } = useQuery({
    queryKey: ["analytics-cash", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_deposits")
        .select("date, amount_usd, branch_id, branches(name)")
        .gte("date", dateFrom).lte("date", dateTo);
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: tanks } = useQuery({
    queryKey: ["analytics-tanks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tanks").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // KPIs
  const kpis = useMemo(() => {
    const totalVolume = salesData?.reduce((s, d) => s + (Number(d.sales_usg) || 0), 0) || 0;
    const totalRevenue = salesData?.reduce((s, d) => s + (Number(d.total_sales_usd) || 0), 0) || 0;
    const totalCash = cashData?.reduce((s, d) => s + (Number(d.amount_usd) || 0), 0) || 0;
    const prevVolume = prevSalesData?.reduce((s, d) => s + (Number(d.sales_usg) || 0), 0) || 0;
    const prevRevenue = prevSalesData?.reduce((s, d) => s + (Number(d.total_sales_usd) || 0), 0) || 0;
    const volumeTrend = prevVolume > 0 ? ((totalVolume - prevVolume) / prevVolume) * 100 : 0;
    const revenueTrend = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const avgDailyRevenue = totalRevenue / (parseInt(period) || 1);
    const collectionRate = totalRevenue > 0 ? (totalCash / totalRevenue) * 100 : 0;
    const lowTanks = tanks?.filter(t => t.status === "Low" || t.status === "Critical").length || 0;

    return { totalVolume, totalRevenue, totalCash, volumeTrend, revenueTrend, avgDailyRevenue, collectionRate, lowTanks };
  }, [salesData, prevSalesData, cashData, tanks, period]);

  // Daily trend data
  const dailyTrend = useMemo(() => {
    if (!salesData) return [];
    const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) });
    return days.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const daySales = salesData.filter(s => s.date === dateStr);
      const pms = daySales.filter(s => (s.pumps as any)?.product_type === "PMS").reduce((sum, s) => sum + (Number(s.sales_usg) || 0), 0);
      const ago = daySales.filter(s => (s.pumps as any)?.product_type === "AGO").reduce((sum, s) => sum + (Number(s.sales_usg) || 0), 0);
      const revenue = daySales.reduce((sum, s) => sum + (Number(s.total_sales_usd) || 0), 0);
      return { date: format(day, "MMM dd"), pms, ago, revenue };
    });
  }, [salesData, dateFrom, dateTo]);

  // Branch ranking
  const branchRanking = useMemo(() => {
    if (!salesData) return [];
    const map = new Map<string, { name: string; revenue: number; volume: number }>();
    salesData.forEach(s => {
      const id = s.branch_id;
      const name = (s.branches as any)?.name || "Unknown";
      if (!map.has(id)) map.set(id, { name, revenue: 0, volume: 0 });
      const b = map.get(id)!;
      b.revenue += Number(s.total_sales_usd) || 0;
      b.volume += Number(s.sales_usg) || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [salesData]);

  // Top attendants
  const topAttendants = useMemo(() => {
    if (!salesData) return [];
    const map = new Map<string, { name: string; revenue: number; transactions: number }>();
    salesData.forEach(s => {
      const name = (s.attendants as any)?.full_name || "Unknown";
      const key = name;
      if (!map.has(key)) map.set(key, { name, revenue: 0, transactions: 0 });
      const a = map.get(key)!;
      a.revenue += Number(s.total_sales_usd) || 0;
      a.transactions += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [salesData]);

  // Tank status distribution
  const tankStatusData = useMemo(() => {
    if (!tanks) return [];
    const counts: Record<string, number> = {};
    tanks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tanks]);

  return (
    <AppLayout title="Analytics" subtitle="Performance metrics, trends, and KPI dashboards">
      {/* Period Selector */}
      <div className="flex items-center gap-4 mb-6">
        <Label>Period</Label>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="14">Last 14 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="60">Last 60 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Volume"
          value={`${kpis.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} USG`}
          icon={<Fuel className="h-6 w-6" />}
          trend={{ value: Math.round(kpis.volumeTrend * 10) / 10, label: "vs prev period" }}
          variant="primary"
        />
        <MetricCard
          title="Total Revenue"
          value={`$${kpis.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-6 w-6" />}
          trend={{ value: Math.round(kpis.revenueTrend * 10) / 10, label: "vs prev period" }}
          variant="success"
        />
        <MetricCard
          title="Avg Daily Revenue"
          value={`$${kpis.avgDailyRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={<BarChart3 className="h-6 w-6" />}
          subtitle="Per day average"
        />
        <MetricCard
          title="Collection Rate"
          value={`${kpis.collectionRate.toFixed(1)}%`}
          icon={<Activity className="h-6 w-6" />}
          variant={kpis.collectionRate >= 95 ? "success" : kpis.collectionRate >= 85 ? "warning" : "danger"}
          subtitle={`${kpis.lowTanks} tank(s) low`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Volume Area */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Volume Trend (USG)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={volumeConfig} className="h-[280px] w-full">
              <AreaChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="pms" name="pms" stackId="1" fill="var(--color-pms)" fillOpacity={0.4} stroke="var(--color-pms)" />
                <Area type="monotone" dataKey="ago" name="ago" stackId="1" fill="var(--color-ago)" fillOpacity={0.4} stroke="var(--color-ago)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue Line */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Trend ($)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueConfig} className="h-[280px] w-full">
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="revenue" name="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Branch Ranking */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Branch Revenue Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {branchRanking.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No data</p>
            ) : (
              <div className="space-y-3">
                {branchRanking.map((b, i) => {
                  const maxRev = branchRanking[0]?.revenue || 1;
                  return (
                    <div key={b.name} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{b.name}</span>
                          <span className="text-muted-foreground">${b.revenue.toFixed(2)} · {b.volume.toFixed(0)} USG</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(b.revenue / maxRev) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tank Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tank Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {tankStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={tankStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {tankStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-8">No tanks</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Attendants */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Top Performing Attendants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topAttendants.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No data</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {topAttendants.map((a, i) => (
                <div key={a.name} className="flex flex-col items-center p-4 rounded-lg bg-muted/50 border">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm mb-2",
                    i === 0 ? "bg-primary/20 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
                  )}>
                    #{i + 1}
                  </div>
                  <p className="text-sm font-medium text-center truncate w-full">{a.name}</p>
                  <p className="text-lg font-bold text-primary">${a.revenue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{a.transactions} sales</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

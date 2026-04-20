import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranchFilter } from "@/hooks/useDealerBranch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, Download, Fuel, DollarSign, TrendingUp, TrendingDown, FileText, Printer, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, subWeeks, subMonths, subYears, eachDayOfInterval, parseISO } from "date-fns";
import { downloadCSV } from "@/lib/csv-export";
import { exportTableToPDF } from "@/lib/pdf-export";
import { buildPDFHeaderInfo } from "@/lib/pdf-header-info";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

const salesChartConfig = {
  pms: { label: "PMS", color: "hsl(var(--primary))" },
  ago: { label: "AGO", color: "hsl(var(--accent))" },
};

const revenueChartConfig = {
  sales: { label: "Sales ($)", color: "hsl(var(--primary))" },
  cash: { label: "Cash ($)", color: "hsl(var(--success))" },
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

const periodPresets = [
  { label: "Today", getValue: () => ({ from: format(new Date(), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last 7 Days", getValue: () => ({ from: format(subDays(new Date(), 7), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last 2 Weeks", getValue: () => ({ from: format(subWeeks(new Date(), 2), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last Month", getValue: () => ({ from: format(subMonths(new Date(), 1), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last 3 Months", getValue: () => ({ from: format(subMonths(new Date(), 3), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last 6 Months", getValue: () => ({ from: format(subMonths(new Date(), 6), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last Year", getValue: () => ({ from: format(subYears(new Date(), 1), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
];

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const { branchFilter, setBranchFilter, isBranchDisabled } = useBranchFilter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, is_active, county, location")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredBranches = useMemo(() => {
    if (!branches) return [];
    if (statusFilter === "active") return branches.filter(b => b.is_active);
    if (statusFilter === "inactive") return branches.filter(b => !b.is_active);
    return branches;
  }, [branches, statusFilter]);

  const activeBranchIds = useMemo(() => {
    if (statusFilter === "all" && branchFilter === "all") return null;
    if (branchFilter !== "all") return [branchFilter];
    return filteredBranches.map(b => b.id);
  }, [filteredBranches, branchFilter, statusFilter]);

  const { data: salesData } = useQuery({
    queryKey: ["report-sales", dateFrom, dateTo, branchFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("shift_sales_reports")
        .select("date, branch_id, sales_usg, total_sales_usd, pumps(product_type), branches(name)")
        .gte("date", dateFrom)
        .lte("date", dateTo);
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      else if (activeBranchIds) q = q.in("branch_id", activeBranchIds);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: reportGenerated,
  });

  const { data: cashData } = useQuery({
    queryKey: ["report-cash", dateFrom, dateTo, branchFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("cash_deposits")
        .select("date, branch_id, deposit_type, amount, amount_usd, branches(name)")
        .gte("date", dateFrom)
        .lte("date", dateTo);
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      else if (activeBranchIds) q = q.in("branch_id", activeBranchIds);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: reportGenerated,
  });

  const dailySummary = useMemo(() => {
    if (!reportGenerated || (!salesData && !cashData)) return [];
    const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) });
    return days.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const daySales = salesData?.filter(s => s.date === dateStr) || [];
      const dayCash = cashData?.filter(c => c.date === dateStr) || [];
      const pmsUsg = daySales.filter(s => (s.pumps as any)?.product_type === "PMS").reduce((sum, s) => sum + (Number(s.sales_usg) || 0), 0);
      const agoUsg = daySales.filter(s => (s.pumps as any)?.product_type === "AGO").reduce((sum, s) => sum + (Number(s.sales_usg) || 0), 0);
      const totalSalesUsd = daySales.reduce((sum, s) => sum + (Number(s.total_sales_usd) || 0), 0);
      const totalCashUsd = dayCash.reduce((sum, c) => sum + (Number(c.amount_usd) || 0), 0);
      const variance = totalCashUsd - totalSalesUsd;
      return { date: dateStr, displayDate: format(day, "MMM dd"), pmsUsg, agoUsg, totalUsg: pmsUsg + agoUsg, totalSalesUsd, totalCashUsd, variance };
    });
  }, [salesData, cashData, dateFrom, dateTo, reportGenerated]);

  const branchSummary = useMemo(() => {
    if (!reportGenerated || (!salesData && !cashData)) return [];
    const branchMap = new Map<string, { name: string; pmsUsg: number; agoUsg: number; salesUsd: number; cashUsd: number }>();
    salesData?.forEach(s => {
      const id = s.branch_id;
      const name = (s.branches as any)?.name || "Unknown";
      if (!branchMap.has(id)) branchMap.set(id, { name, pmsUsg: 0, agoUsg: 0, salesUsd: 0, cashUsd: 0 });
      const b = branchMap.get(id)!;
      const usg = Number(s.sales_usg) || 0;
      if ((s.pumps as any)?.product_type === "PMS") b.pmsUsg += usg; else b.agoUsg += usg;
      b.salesUsd += Number(s.total_sales_usd) || 0;
    });
    cashData?.forEach(c => {
      const id = c.branch_id;
      const name = (c.branches as any)?.name || "Unknown";
      if (!branchMap.has(id)) branchMap.set(id, { name, pmsUsg: 0, agoUsg: 0, salesUsd: 0, cashUsd: 0 });
      branchMap.get(id)!.cashUsd += Number(c.amount_usd) || 0;
    });
    return Array.from(branchMap.entries()).map(([id, v]) => ({ id, ...v, variance: v.cashUsd - v.salesUsd }));
  }, [salesData, cashData, reportGenerated]);

  const grandTotals = useMemo(() => ({
    pmsUsg: dailySummary.reduce((s, d) => s + d.pmsUsg, 0),
    agoUsg: dailySummary.reduce((s, d) => s + d.agoUsg, 0),
    totalUsg: dailySummary.reduce((s, d) => s + d.totalUsg, 0),
    salesUsd: dailySummary.reduce((s, d) => s + d.totalSalesUsd, 0),
    cashUsd: dailySummary.reduce((s, d) => s + d.totalCashUsd, 0),
    variance: dailySummary.reduce((s, d) => s + d.variance, 0),
  }), [dailySummary]);

  const productMixData = useMemo(() => [
    { name: "PMS", value: grandTotals.pmsUsg },
    { name: "AGO", value: grandTotals.agoUsg },
  ].filter(d => d.value > 0), [grandTotals]);

  const applyPreset = (preset: typeof periodPresets[0]) => {
    const { from, to } = preset.getValue();
    setDateFrom(from);
    setDateTo(to);
    setReportGenerated(false);
  };

  const generateReport = () => setReportGenerated(true);

  const printReport = () => {
    const reportTitle = activeTab === "daily" ? "Daily Sales Report" : "Branch Performance Report";
    const subtitle = `${format(parseISO(dateFrom), "MMM dd, yyyy")} to ${format(parseISO(dateTo), "MMM dd, yyyy")}${statusFilter !== "all" ? ` (${statusFilter} branches only)` : ""}`;
    if (activeTab === "daily") {
      exportTableToPDF(
        reportTitle, subtitle,
        ["Date", "PMS (USG)", "AGO (USG)", "Total (USG)", "Sales ($)", "Cash ($)", "Variance ($)"],
        dailySummary.map(d => [d.displayDate, d.pmsUsg.toFixed(1), d.agoUsg.toFixed(1), d.totalUsg.toFixed(1), `$${d.totalSalesUsd.toFixed(2)}`, `$${d.totalCashUsd.toFixed(2)}`, `${d.variance >= 0 ? "+" : ""}$${d.variance.toFixed(2)}`]),
        [
          { label: "Total Volume", value: `${grandTotals.totalUsg.toLocaleString(undefined, { maximumFractionDigits: 0 })} USG` },
          { label: "Total Sales", value: `$${grandTotals.salesUsd.toFixed(2)}` },
          { label: "Total Cash", value: `$${grandTotals.cashUsd.toFixed(2)}` },
          { label: "Variance", value: `${grandTotals.variance >= 0 ? "+" : ""}$${grandTotals.variance.toFixed(2)}` },
        ]
      );
    } else {
      exportTableToPDF(
        reportTitle, subtitle,
        ["Branch", "PMS (USG)", "AGO (USG)", "Sales ($)", "Cash ($)", "Variance ($)"],
        branchSummary.map(b => [b.name, b.pmsUsg.toFixed(1), b.agoUsg.toFixed(1), `$${b.salesUsd.toFixed(2)}`, `$${b.cashUsd.toFixed(2)}`, `${b.variance >= 0 ? "+" : ""}$${b.variance.toFixed(2)}`])
      );
    }
  };

  const exportCSV = () => {
    if (activeTab === "daily") {
      downloadCSV(`daily-report-${dateFrom}-to-${dateTo}.csv`,
        ["Date", "PMS (USG)", "AGO (USG)", "Total (USG)", "Sales ($)", "Cash ($)", "Variance ($)"],
        dailySummary.map(d => [d.displayDate, d.pmsUsg.toFixed(1), d.agoUsg.toFixed(1), d.totalUsg.toFixed(1), d.totalSalesUsd.toFixed(2), d.totalCashUsd.toFixed(2), d.variance.toFixed(2)])
      );
    } else {
      downloadCSV(`branch-report-${dateFrom}-to-${dateTo}.csv`,
        ["Branch", "PMS (USG)", "AGO (USG)", "Sales ($)", "Cash ($)", "Variance ($)"],
        branchSummary.map(b => [b.name, b.pmsUsg.toFixed(1), b.agoUsg.toFixed(1), b.salesUsd.toFixed(2), b.cashUsd.toFixed(2), b.variance.toFixed(2)])
      );
    }
  };

  return (
    <AppLayout title="Reports" subtitle="Consolidated daily and weekly summaries across all branches">
      {/* Filters */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileBarChart className="h-5 w-5 text-primary" /> Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period Presets */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Quick Period</Label>
            <div className="flex flex-wrap gap-2">
              {periodPresets.map(p => (
                <Button key={p.label} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setReportGenerated(false); }} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setReportGenerated(false); }} />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setReportGenerated(false); }} disabled={isBranchDisabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {filteredBranches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setReportGenerated(false); }}>
                <SelectTrigger>
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={generateReport} className="flex-1 sm:flex-none">
              <FileBarChart className="h-4 w-4 mr-2" /> Generate Report
            </Button>
            {reportGenerated && (
              <>
                <Button variant="outline" onClick={printReport}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
                <Button variant="outline" onClick={() => exportCSV()}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!reportGenerated ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select filters and generate a report</h3>
            <p className="text-muted-foreground text-sm">Choose a period, branch, and status filter above, then click "Generate Report"</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Fuel className="h-5 w-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Volume</p>
                    <p className="text-lg sm:text-xl font-bold truncate">{grandTotals.totalUsg.toLocaleString(undefined, { maximumFractionDigits: 0 })} USG</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="text-lg sm:text-xl font-bold truncate">${grandTotals.salesUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <DollarSign className="h-5 w-5 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Cash</p>
                    <p className="text-lg sm:text-xl font-bold truncate">${grandTotals.cashUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", grandTotals.variance >= 0 ? "bg-success/10" : "bg-destructive/10")}>
                    {grandTotals.variance >= 0 ? <TrendingUp className="h-5 w-5 text-success" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Variance</p>
                    <p className={cn("text-lg sm:text-xl font-bold truncate", grandTotals.variance >= 0 ? "text-success" : "text-destructive")}>
                      {grandTotals.variance >= 0 ? "+" : ""}${grandTotals.variance.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Sales Volume (USG)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={salesChartConfig} className="h-[250px] sm:h-[280px] w-full">
                  <BarChart data={dailySummary}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="pmsUsg" name="pms" fill="var(--color-pms)" radius={[4, 4, 0, 0]} stackId="fuel" />
                    <Bar dataKey="agoUsg" name="ago" fill="var(--color-ago)" radius={[4, 4, 0, 0]} stackId="fuel" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Product Mix</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                {productMixData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={productMixData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {productMixData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm py-12">No data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue Trend */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue vs Cash Collected ($)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[220px] sm:h-[260px] w-full">
                <LineChart data={dailySummary}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="totalSalesUsd" name="sales" stroke="var(--color-sales)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="totalCashUsd" name="cash" stroke="var(--color-cash)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Data Tables */}
          <Tabs defaultValue="daily" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="daily">Daily Summary</TabsTrigger>
              <TabsTrigger value="branch">By Branch</TabsTrigger>
            </TabsList>

            <TabsContent value="daily">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <CardTitle className="text-base">Daily Summary — {format(parseISO(dateFrom), "MMM dd")} to {format(parseISO(dateTo), "MMM dd, yyyy")}</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={printReport}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                      <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">PMS (USG)</TableHead>
                        <TableHead className="text-right">AGO (USG)</TableHead>
                        <TableHead className="text-right">Total (USG)</TableHead>
                        <TableHead className="text-right">Sales ($)</TableHead>
                        <TableHead className="text-right">Cash ($)</TableHead>
                        <TableHead className="text-right">Variance ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailySummary.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data for selected period</TableCell></TableRow>
                      ) : (
                        <>
                          {dailySummary.map(d => (
                            <TableRow key={d.date}>
                              <TableCell className="font-medium">{d.displayDate}</TableCell>
                              <TableCell className="text-right">{d.pmsUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                              <TableCell className="text-right">{d.agoUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                              <TableCell className="text-right font-medium">{d.totalUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                              <TableCell className="text-right">${d.totalSalesUsd.toFixed(2)}</TableCell>
                              <TableCell className="text-right">${d.totalCashUsd.toFixed(2)}</TableCell>
                              <TableCell className={cn("text-right font-bold", d.variance >= 0 ? "text-success" : "text-destructive")}>
                                {d.variance >= 0 ? "+" : ""}${d.variance.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>TOTAL</TableCell>
                            <TableCell className="text-right">{grandTotals.pmsUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                            <TableCell className="text-right">{grandTotals.agoUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                            <TableCell className="text-right">{grandTotals.totalUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                            <TableCell className="text-right">${grandTotals.salesUsd.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${grandTotals.cashUsd.toFixed(2)}</TableCell>
                            <TableCell className={cn("text-right", grandTotals.variance >= 0 ? "text-success" : "text-destructive")}>
                              {grandTotals.variance >= 0 ? "+" : ""}${grandTotals.variance.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branch">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <CardTitle className="text-base">Branch Performance Summary</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={printReport}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                      <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">PMS (USG)</TableHead>
                        <TableHead className="text-right">AGO (USG)</TableHead>
                        <TableHead className="text-right">Sales ($)</TableHead>
                        <TableHead className="text-right">Cash ($)</TableHead>
                        <TableHead className="text-right">Variance ($)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchSummary.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data for selected period</TableCell></TableRow>
                      ) : (
                        branchSummary.map(b => (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium">{b.name}</TableCell>
                            <TableCell className="text-right">{b.pmsUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                            <TableCell className="text-right">{b.agoUsg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                            <TableCell className="text-right">${b.salesUsd.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${b.cashUsd.toFixed(2)}</TableCell>
                            <TableCell className={cn("text-right font-bold", b.variance >= 0 ? "text-success" : "text-destructive")}>
                              {b.variance >= 0 ? "+" : ""}${b.variance.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs", Math.abs(b.variance) > 50 ? "border-destructive text-destructive" : "border-success text-success")}>
                                {Math.abs(b.variance) > 50 ? "Review" : "OK"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppLayout>
  );
}

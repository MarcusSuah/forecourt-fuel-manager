import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, TrendingDown, TrendingUp, AlertTriangle, BarChart3, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

export default function StockControl() {
  const [branchFilter, setBranchFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tanks } = useQuery({
    queryKey: ["tanks-stock", branchFilter],
    queryFn: async () => {
      let q = supabase.from("tanks").select("*, branches(name)").eq("is_active", true);
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      if (productFilter !== "all") q = q.eq("product_type", productFilter as "PMS" | "AGO");
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sales in period for throughput calculation
  const { data: salesData } = useQuery({
    queryKey: ["sales-period", dateFrom, dateTo, branchFilter],
    queryFn: async () => {
      let q = supabase.from("shift_sales_reports")
        .select("pump_id, sales_usg, pumps(branch_id, product_type)")
        .gte("date", dateFrom)
        .lte("date", dateTo);
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Fetch stock readings in period
  const { data: stockReadings } = useQuery({
    queryKey: ["stock-readings", dateFrom, dateTo, branchFilter],
    queryFn: async () => {
      let q = supabase.from("stock_readings")
        .select("*, tanks(name, product_type), branches(name)")
        .gte("date", dateFrom)
        .lte("date", dateTo);
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      const { data, error } = await q.order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Aggregate throughput by product type
  const throughput = useMemo(() => {
    if (!salesData) return { pms: 0, ago: 0, total: 0 };
    const pms = salesData
      .filter(s => (s.pumps as any)?.product_type === "PMS")
      .reduce((sum, s) => sum + (Number(s.sales_usg) || 0), 0);
    const ago = salesData
      .filter(s => (s.pumps as any)?.product_type === "AGO")
      .reduce((sum, s) => sum + (Number(s.sales_usg) || 0), 0);
    return { pms, ago, total: pms + ago };
  }, [salesData]);

  // Tank-level stock analysis
  const tankAnalysis = useMemo(() => {
    if (!tanks) return [];
    return tanks.map((tank) => {
      const capacity = Number(tank.capacity_usg);
      const current = Number(tank.current_level_usg);
      const pct = capacity > 0 ? (current / capacity) * 100 : 0;

      // Get latest stock reading for this tank
      const latestReading = stockReadings?.find(r => r.tank_id === tank.id);
      const physicalLevel = latestReading ? Number(latestReading.physical_level_usg) : current;
      const theoreticalLevel = latestReading ? Number(latestReading.theoretical_level_usg) : current;
      const variance = physicalLevel - theoreticalLevel;
      const variancePct = theoreticalLevel > 0 ? (variance / theoreticalLevel) * 100 : 0;

      // Calculate throughput for this tank's branch & product
      const tankThroughput = salesData
        ?.filter(s => (s.pumps as any)?.branch_id === tank.branch_id && (s.pumps as any)?.product_type === tank.product_type)
        .reduce((sum, s) => sum + (Number(s.sales_usg) || 0), 0) || 0;

      return {
        ...tank,
        branchName: (tank.branches as any)?.name || "Unknown",
        pct,
        physicalLevel,
        theoreticalLevel,
        variance,
        variancePct,
        tankThroughput,
      };
    }).filter(t => productFilter === "all" || t.product_type === productFilter);
  }, [tanks, stockReadings, salesData, productFilter]);

  const totalVariance = tankAnalysis.reduce((s, t) => s + t.variance, 0);
  const totalPhysical = tankAnalysis.reduce((s, t) => s + t.physicalLevel, 0);

  return (
    <AppLayout title="Fuel Stock Control" subtitle="Throughput, variance, and loss/gain analysis">
      {/* Filters */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" /> Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="PMS">PMS (Petrol)</SelectItem>
                  <SelectItem value="AGO">AGO (Diesel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Fuel className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PMS Throughput</p>
                <p className="text-xl font-bold">{throughput.pms.toLocaleString()} USG</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Fuel className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AGO Throughput</p>
                <p className="text-xl font-bold">{throughput.ago.toLocaleString()} USG</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Physical Stock</p>
                <p className="text-xl font-bold">{totalPhysical.toLocaleString()} USG</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center",
                totalVariance >= 0 ? "bg-success/10" : "bg-destructive/10"
              )}>
                {totalVariance >= 0
                  ? <TrendingUp className="h-5 w-5 text-success" />
                  : <TrendingDown className="h-5 w-5 text-destructive" />
                }
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Variance</p>
                <p className={cn("text-xl font-bold", totalVariance >= 0 ? "text-success" : "text-destructive")}>
                  {totalVariance >= 0 ? "+" : ""}{totalVariance.toFixed(1)} USG
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tank Stock Detail Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Fuel className="h-5 w-5 text-primary" />
            Stock Control Detail — {format(new Date(dateFrom), "MMM dd")} to {format(new Date(dateTo), "MMM dd, yyyy")}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => {
            downloadCSV(`stock-control-${dateFrom}-to-${dateTo}.csv`,
              ["Tank", "Branch", "Product", "Capacity", "Physical Stock", "Theoretical Stock", "Variance", "Var %", "Throughput", "Status"],
              tankAnalysis.map(t => [t.name, t.branchName, t.product_type, Number(t.capacity_usg), t.physicalLevel, t.theoreticalLevel, t.variance.toFixed(1), t.variancePct.toFixed(2) + "%", t.tankThroughput, Math.abs(t.variancePct) > 1 ? (t.variance < 0 ? "Loss" : "Gain") : "Normal"])
            );
          }}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tank</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Physical Stock</TableHead>
                <TableHead className="text-right">Theoretical Stock</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Var %</TableHead>
                <TableHead className="text-right">Throughput</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tankAnalysis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No tank data found for the selected filters
                  </TableCell>
                </TableRow>
              ) : (
                tankAnalysis.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.branchName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs",
                        t.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago"
                      )}>
                        {t.product_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(t.capacity_usg).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{t.physicalLevel.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{t.theoreticalLevel.toLocaleString()}</TableCell>
                    <TableCell className={cn("text-right font-bold",
                      t.variance > 0 ? "text-success" : t.variance < 0 ? "text-destructive" : ""
                    )}>
                      {t.variance > 0 ? "+" : ""}{t.variance.toFixed(1)}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm",
                      Math.abs(t.variancePct) > 1 ? "text-destructive font-semibold" : "text-muted-foreground"
                    )}>
                      {t.variancePct > 0 ? "+" : ""}{t.variancePct.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">{t.tankThroughput.toLocaleString()}</TableCell>
                    <TableCell>
                      {Math.abs(t.variancePct) > 1 ? (
                        <Badge variant="outline" className="border-destructive text-destructive text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t.variance < 0 ? "Loss" : "Gain"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-success text-success text-xs">Normal</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

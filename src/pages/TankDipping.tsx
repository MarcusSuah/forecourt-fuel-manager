import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Droplets, Save, TrendingDown, TrendingUp, RotateCcw, AlertTriangle, Settings2, ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { Link } from "react-router-dom";

// Tiny inline sparkline. Negative values are red, non-negative blue.
function Sparkline({ values, width = 80, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (!values || values.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height / 2 - (v / max) * (height / 2 - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const stroke = last < 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))";
  return (
    <svg width={width} height={height} className="overflow-visible">
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="hsl(var(--border))" strokeDasharray="2,2" />
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} points={points} />
    </svg>
  );
}

export default function TankDipping() {
  const { user } = useAuth();
  const { isDealer, dealerBranchId } = useDealerBranch();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(dealerBranchId || "");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dips, setDips] = useState<Record<string, number>>({});
  const [openings, setOpenings] = useState<Record<string, number>>({});
  const [thresholdDraft, setThresholdDraft] = useState<Record<string, string>>({});
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});

  const branchId = isDealer ? dealerBranchId : selectedBranch;

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    enabled: !isDealer,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: tanks } = useQuery({
    queryKey: ["tanks-dipping", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tanks").select("*").eq("branch_id", branchId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Previous shift dip (carry-over)
  const { data: prevDips } = useQuery({
    queryKey: ["prev-dips", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const shiftOrder = shifts?.map((s) => s.id) ?? [];
      const currentIdx = shiftOrder.indexOf(selectedShift);
      let prevShiftId: string | null = null;
      let prevDate = selectedDate;
      if (currentIdx > 0) {
        prevShiftId = shiftOrder[currentIdx - 1];
      } else if (currentIdx === 0 && shiftOrder.length > 0) {
        prevShiftId = shiftOrder[shiftOrder.length - 1];
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 1);
        prevDate = format(d, "yyyy-MM-dd");
      }
      if (!prevShiftId) return [];
      const { data, error } = await supabase
        .from("stock_readings")
        .select("tank_id, physical_level_usg")
        .eq("branch_id", branchId!)
        .eq("shift_id", prevShiftId)
        .eq("date", prevDate);
      if (error) throw error;
      return data;
    },
  });

  // Current shift readings
  const { data: currentReadings } = useQuery({
    queryKey: ["current-dips", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_readings")
        .select("*")
        .eq("branch_id", branchId!)
        .eq("shift_id", selectedShift)
        .eq("date", selectedDate);
      if (error) throw error;
      return data;
    },
  });

  // Pump meter sales for the same shift/date/branch, grouped by tank via tank_pump_assignments
  const { data: pumpSales } = useQuery({
    queryKey: ["pump-sales-by-tank", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const { data: sales, error: e1 } = await supabase
        .from("shift_sales_reports")
        .select("pump_id, sales_usg")
        .eq("branch_id", branchId!)
        .eq("shift_id", selectedShift)
        .eq("date", selectedDate);
      if (e1) throw e1;
      const { data: links, error: e2 } = await supabase
        .from("tank_pump_assignments")
        .select("tank_id, pump_id");
      if (e2) throw e2;
      const byTank: Record<string, number> = {};
      (sales ?? []).forEach((s) => {
        const tankIds = (links ?? []).filter((l) => l.pump_id === s.pump_id).map((l) => l.tank_id);
        tankIds.forEach((tid) => {
          byTank[tid] = (byTank[tid] ?? 0) + Number(s.sales_usg ?? 0);
        });
      });
      return byTank;
    },
  });

  // Carry-over default for opening dip (previous shift's closing)
  const getCarryOverOpening = (tankId: string) => {
    const prev = prevDips?.find((d) => d.tank_id === tankId);
    return prev ? Number(prev.physical_level_usg) : 0;
  };

  const getOpeningDip = (tankId: string) => {
    if (openings[tankId] !== undefined) return openings[tankId];
    const saved = currentReadings?.find((r) => r.tank_id === tankId);
    if (saved) return Number(saved.theoretical_level_usg);
    return getCarryOverOpening(tankId);
  };

  // Summary stats for selected shift
  const summary = useMemo(() => {
    const list = tanks ?? [];
    let criticalCount = 0;
    let totalAbsVariance = 0;
    let withReading = 0;
    list.forEach((t) => {
      const opening = getOpeningDip(t.id);
      const closingRaw = dips[t.id] ?? currentReadings?.find((r) => r.tank_id === t.id)?.physical_level_usg;
      if (closingRaw === undefined || closingRaw === null || (closingRaw as unknown) === "") return;
      withReading += 1;
      const tankSales = opening - Number(closingRaw);
      const meterSales = pumpSales?.[t.id] ?? 0;
      const variance = tankSales - meterSales;
      const threshold = Number(t.reconciliation_threshold_usg ?? 0);
      totalAbsVariance += Math.abs(variance);
      if (threshold > 0 && Math.abs(variance) > threshold) criticalCount += 1;
    });
    return { totalTanks: list.length, withReading, criticalCount, totalAbsVariance };
  }, [tanks, dips, openings, currentReadings, pumpSales, prevDips]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!branchId || !selectedShift) throw new Error("Select branch and shift");
      const tanksToSave = (tanks ?? []).filter((t) => dips[t.id] !== undefined);
      const entries = tanksToSave
        .filter((t) => dips[t.id] !== undefined)
        .map((t) => ({
          branch_id: branchId,
          tank_id: t.id,
          shift_id: selectedShift,
          date: selectedDate,
          physical_level_usg: dips[t.id],
          theoretical_level_usg: getOpeningDip(t.id),
          created_by: user?.id,
        }));
      if (entries.length === 0) throw new Error("Enter at least one dip reading");
      const { data: saved, error } = await supabase
        .from("stock_readings")
        .upsert(entries, { onConflict: "branch_id,tank_id,shift_id,date" })
        .select("id, tank_id");
      if (error) throw error;

      // Auto-dispatch critical reconciliation alerts
      const branchName = branches?.find((b) => b.id === branchId)?.name ?? "Branch";
      const criticals = tanksToSave
        .map((t) => {
          const opening = getOpeningDip(t.id);
          const closing = Number(dips[t.id]);
          const tankSales = opening - closing;
          const meterSales = pumpSales?.[t.id] ?? 0;
          const variance = tankSales - meterSales;
          const threshold = Number(t.reconciliation_threshold_usg ?? 0);
          return { tank: t, variance, threshold };
        })
        .filter((x) => x.threshold > 0 && Math.abs(x.variance) > x.threshold);

      await Promise.all(
        criticals.map(({ tank, variance, threshold }) => {
          const stockReadingId = saved?.find((s) => s.tank_id === tank.id)?.id;
          return supabase.functions.invoke("send-reconciliation-alert", {
            body: {
              tank_id: tank.id,
              branch_id: branchId,
              tank_name: tank.name,
              branch_name: branchName,
              product_type: tank.product_type,
              loss_usg: variance < 0 ? variance : -Math.abs(variance),
              threshold_usg: threshold,
              stock_reading_id: stockReadingId,
              dip_date: selectedDate,
            },
          });
        })
      );
      return { criticalCount: criticals.length };
    },
    onSuccess: (res) => {
      toast.success("Dip readings saved");
      if (res?.criticalCount) {
        toast.warning(`${res.criticalCount} critical variance alert(s) dispatched`);
      }
      queryClient.invalidateQueries({ queryKey: ["current-dips"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
      setDips({});
      setOpenings({});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Update reconciliation threshold for a tank
  const thresholdMutation = useMutation({
    mutationFn: async ({ tankId, value }: { tankId: string; value: number }) => {
      const { error } = await supabase
        .from("tanks")
        .update({ reconciliation_threshold_usg: value })
        .eq("id", tankId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Threshold updated");
      queryClient.invalidateQueries({ queryKey: ["tanks-dipping"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Recent open (unresolved) reconciliation alerts for selected branch
  const { data: recentAlerts } = useQuery({
    queryKey: ["recent-open-alerts", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliation_alerts")
        .select("id, created_at, loss_usg, threshold_usg, severity, tank_id, tanks(name, product_type)")
        .eq("branch_id", branchId!)
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // 7-day variance trend per tank for sparklines
  const { data: variance7d } = useQuery({
    queryKey: ["variance-7d", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const since = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("stock_readings")
        .select("tank_id, date, variance_usg, created_at")
        .eq("branch_id", branchId!)
        .gte("date", since)
        .order("date", { ascending: true });
      if (error) throw error;
      // Aggregate variance by tank+date (sum across shifts on same day), then keep ordered list
      const byTankDate: Record<string, Record<string, number>> = {};
      (data ?? []).forEach((r: any) => {
        const v = Number(r.variance_usg ?? 0);
        byTankDate[r.tank_id] ??= {};
        byTankDate[r.tank_id][r.date] = (byTankDate[r.tank_id][r.date] ?? 0) + v;
      });
      const result: Record<string, number[]> = {};
      Object.entries(byTankDate).forEach(([tid, m]) => {
        const days: number[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = format(subDays(new Date(), i), "yyyy-MM-dd");
          days.push(m[d] ?? 0);
        }
        result[tid] = days;
      });
      return result;
    },
  });

  // Resolve a reconciliation alert with optional note
  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, note }: { alertId: string; note: string }) => {
      const { error } = await supabase
        .from("reconciliation_alerts")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
          resolution_notes: note?.trim() ? note.trim() : null,
        })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Alert resolved");
      setResolveNotes((p) => {
        const { [vars.alertId]: _, ...rest } = p;
        return rest;
      });
      queryClient.invalidateQueries({ queryKey: ["recent-open-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["header-recon-alerts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout title="Daily Tank Dipping" subtitle="Record opening and closing dip readings per shift">
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            {!isDealer && (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>{shifts?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {branchId && selectedShift && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Tanks</p>
                    <p className="text-2xl font-bold">{summary.totalTanks}</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary.withReading} with readings</p>
                  </div>
                  <Droplets className="h-8 w-8 text-primary opacity-70" />
                </div>
              </CardContent>
            </Card>
            <Card className={cn(summary.criticalCount > 0 && "border-destructive/50 bg-destructive/5")}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Critical Variances</p>
                    <p className={cn("text-2xl font-bold", summary.criticalCount > 0 && "text-destructive")}>
                      {summary.criticalCount}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Over tank threshold</p>
                  </div>
                  <AlertTriangle className={cn("h-8 w-8 opacity-70", summary.criticalCount > 0 ? "text-destructive" : "text-muted-foreground")} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total |Variance|</p>
                    <p className="text-2xl font-bold">{summary.totalAbsVariance.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                    <p className="text-xs text-muted-foreground mt-1">USG across all tanks</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-warning opacity-70" />
                </div>
              </CardContent>
            </Card>
          </div>
          {recentAlerts && recentAlerts.length > 0 && (
            <Card className="mb-4 border-destructive/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Recent Open Alerts ({recentAlerts.length})
                  </CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/reconciliation-alerts">
                      View all <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="divide-y">
                  {recentAlerts.map((a: any) => (
                    <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className={cn("text-[10px]", a.tanks?.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>
                          {a.tanks?.product_type ?? "—"}
                        </Badge>
                        <span className="font-medium truncate">{a.tanks?.name ?? "Tank"}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-destructive font-semibold">{Number(a.loss_usg).toLocaleString()} USG</span>
                        <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] capitalize">{a.severity}</Badge>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 px-2">
                              <Check className="h-3 w-3 mr-1" /> Resolve
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72" align="end">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Resolve alert</p>
                              <p className="text-xs text-muted-foreground">{a.tanks?.name ?? "Tank"} · {Number(a.loss_usg).toLocaleString()} USG</p>
                              <Textarea
                                placeholder="Optional resolution note (root cause, action taken)..."
                                value={resolveNotes[a.id] ?? ""}
                                onChange={(e) => setResolveNotes((p) => ({ ...p, [a.id]: e.target.value }))}
                                className="min-h-[70px] text-xs"
                              />
                              <Button
                                size="sm"
                                className="w-full"
                                disabled={resolveMutation.isPending}
                                onClick={() => resolveMutation.mutate({ alertId: a.id, note: resolveNotes[a.id] ?? "" })}
                              >
                                Mark resolved
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-5 w-5 text-primary" /> Tank Dip Readings
              </CardTitle>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save Readings
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Capacity (USG)</TableHead>
                  <TableHead>Opening Dip (USG)</TableHead>
                  <TableHead>Closing Dip (USG)</TableHead>
                  <TableHead className="text-right">Sales (USG)</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">7-day trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tanks ?? []).map((tank) => {
                  const opening = getOpeningDip(tank.id);
                  const closingRaw = dips[tank.id] ?? currentReadings?.find((r) => r.tank_id === tank.id)?.physical_level_usg ?? "";
                  const hasClosing = closingRaw !== "" && closingRaw !== null && closingRaw !== undefined;
                  const tankSales = hasClosing ? opening - Number(closingRaw) : null;
                  const meterSales = pumpSales?.[tank.id] ?? 0;
                  const variance = tankSales !== null ? tankSales - meterSales : null;
                  const threshold = Number(tank.reconciliation_threshold_usg ?? 0);
                  const isCritical = variance !== null && threshold > 0 && Math.abs(variance) > threshold;
                  const carryOver = getCarryOverOpening(tank.id);
                  return (
                    <TableRow key={tank.id} className={cn(isCritical && "bg-destructive/10 hover:bg-destructive/15")}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isCritical && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                          {tank.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", tank.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>
                          {tank.product_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{Number(tank.capacity_usg).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="w-32"
                            value={openings[tank.id] ?? opening}
                            onChange={(e) => setOpenings((prev) => ({ ...prev, [tank.id]: Number(e.target.value) }))}
                            placeholder="Opening dip"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title={`Reset to carry-over (${carryOver.toLocaleString()})`}
                            onClick={() => setOpenings((prev) => ({ ...prev, [tank.id]: carryOver }))}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                title={`Configure threshold (current: ±${threshold.toLocaleString()} USG)`}
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64" align="end">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm font-medium">Reconciliation Threshold</p>
                                  <p className="text-xs text-muted-foreground">{tank.name} • Variance over this triggers a critical alert.</p>
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`thr-${tank.id}`} className="text-xs">Threshold (USG)</Label>
                                  <Input
                                    id={`thr-${tank.id}`}
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    value={thresholdDraft[tank.id] ?? String(threshold)}
                                    onChange={(e) => setThresholdDraft((p) => ({ ...p, [tank.id]: e.target.value }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  disabled={thresholdMutation.isPending}
                                  onClick={() => {
                                    const v = Number(thresholdDraft[tank.id] ?? threshold);
                                    if (Number.isNaN(v) || v < 0) {
                                      toast.error("Enter a valid non-negative number");
                                      return;
                                    }
                                    thresholdMutation.mutate({ tankId: tank.id, value: v });
                                  }}
                                >
                                  Save threshold
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-32"
                          value={dips[tank.id] ?? (currentReadings?.find((r) => r.tank_id === tank.id)?.physical_level_usg ?? "")}
                          onChange={(e) => setDips((prev) => ({ ...prev, [tank.id]: Number(e.target.value) }))}
                          placeholder="Enter dip"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{tankSales !== null ? tankSales.toLocaleString() : "—"}</div>
                        <div className="text-xs text-muted-foreground">Meter: {meterSales.toLocaleString()}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {variance !== null && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={cn("font-bold", isCritical ? "text-destructive" : Math.abs(variance) < 0.01 ? "text-success" : variance > 0 ? "text-warning" : "text-destructive")}>
                              {variance >= 0 ? "+" : ""}{variance.toLocaleString()}
                            </span>
                            {threshold > 0 && (
                              <span className="text-[10px] text-muted-foreground">Threshold: ±{threshold.toLocaleString()}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </>
      )}
    </AppLayout>
  );
}

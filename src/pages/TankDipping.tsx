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
import { toast } from "sonner";
import { Droplets, Save, TrendingDown, TrendingUp, RotateCcw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function TankDipping() {
  const { user } = useAuth();
  const { isDealer, dealerBranchId } = useDealerBranch();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(dealerBranchId || "");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dips, setDips] = useState<Record<string, number>>({});
  const [openings, setOpenings] = useState<Record<string, number>>({});

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!branchId || !selectedShift) throw new Error("Select branch and shift");
      const entries = (tanks ?? [])
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
      const { error } = await supabase.from("stock_readings").upsert(entries, { onConflict: "branch_id,tank_id,shift_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dip readings saved");
      queryClient.invalidateQueries({ queryKey: ["current-dips"] });
      setDips({});
      setOpenings({});
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
      )}
    </AppLayout>
  );
}

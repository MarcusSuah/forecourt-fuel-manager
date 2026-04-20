import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Gauge, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCSV } from "@/lib/csv-export";
import { exportTableToPDF } from "@/lib/pdf-export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MeterReading() {
  const { isDealer, dealerBranchId } = useDealerBranch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(dealerBranchId || "");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meters, setMeters] = useState<Record<string, number>>({});
  const [openings, setOpenings] = useState<Record<string, number>>({});
  const [rtts, setRtts] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [attendantSel, setAttendantSel] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const { data: pumps } = useQuery({
    queryKey: ["pumps-meter", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("pumps").select("*").eq("branch_id", branchId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: branchAttendants } = useQuery({
    queryKey: ["branch-attendants", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendants")
        .select("id, full_name")
        .eq("branch_id", branchId!)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Batch carry-over: get previous shift closing meters for all pumps
  const { data: prevMeters } = useQuery({
    queryKey: ["prev-meters-batch", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift && !!shifts,
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
        .from("shift_sales_reports")
        .select("pump_id, closing_meter, unit_price_usd")
        .eq("branch_id", branchId!)
        .eq("shift_id", prevShiftId)
        .eq("date", prevDate);
      if (error) throw error;
      return data;
    },
  });

  // Attendants assigned to specific pumps for this shift+date
  const { data: assignments } = useQuery({
    queryKey: ["pump-attendant-assignments", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendant_assignments")
        .select("pump_id, attendant_id, attendants!inner(id, full_name, branch_id, is_active)")
        .eq("date", selectedDate)
        .eq("shift_id", selectedShift)
        .eq("attendants.branch_id", branchId!)
        .eq("attendants.is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: existingReadings } = useQuery({
    queryKey: ["existing-meter-readings", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_sales_reports")
        .select("pump_id, opening_meter, closing_meter, rtt_usg, attendant_id, unit_price_usd")
        .eq("branch_id", branchId!)
        .eq("shift_id", selectedShift)
        .eq("date", selectedDate);
      if (error) throw error;
      return data;
    },
  });

  const getOpeningMeter = (pumpId: string) => {
    const prev = prevMeters?.find((m) => m.pump_id === pumpId);
    return prev ? Number(prev.closing_meter) : 0;
  };

  const getPrevPrice = (pumpId: string) => {
    const prev = prevMeters?.find((m) => m.pump_id === pumpId);
    return prev ? Number(prev.unit_price_usd) || 0 : 0;
  };

  const getPumpAttendants = (pumpId: string) => {
    const assigned = (assignments ?? [])
      .filter((a) => a.pump_id === pumpId)
      .map((a: any) => ({ id: a.attendants.id, full_name: a.attendants.full_name }));
    if (assigned.length > 0) return assigned;
    return branchAttendants ?? [];
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!branchId || !selectedShift) throw new Error("Select branch and shift");
      const pumpIds = Object.keys({ ...meters, ...openings, ...rtts, ...prices, ...attendantSel });
      if (pumpIds.length === 0) throw new Error("No readings to save");

      const rows = pumpIds.map((pumpId) => {
        const existing = existingReadings?.find((r) => r.pump_id === pumpId);
        const opening =
          openings[pumpId] ?? existing?.opening_meter ?? getOpeningMeter(pumpId);
        const closing = meters[pumpId] ?? existing?.closing_meter ?? 0;
        const rtt = rtts[pumpId] ?? existing?.rtt_usg ?? 0;
        const price = prices[pumpId] ?? existing?.unit_price_usd ?? 0;
        const attendantId = attendantSel[pumpId] ?? existing?.attendant_id;
        if (!attendantId) {
          throw new Error("Select an attendant for every pump with readings.");
        }
        return {
          branch_id: branchId,
          shift_id: selectedShift,
          date: selectedDate,
          pump_id: pumpId,
          attendant_id: attendantId,
          opening_meter: Number(opening) || 0,
          closing_meter: Number(closing) || 0,
          rtt_usg: Number(rtt) || 0,
          unit_price_usd: Number(price) || 0,
          created_by: user?.id ?? null,
        };
      });

      const { error } = await supabase
        .from("shift_sales_reports")
        .upsert(rows, { onConflict: "branch_id,pump_id,shift_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meter readings saved");
      qc.invalidateQueries({ queryKey: ["existing-meter-readings"] });
      qc.invalidateQueries({ queryKey: ["prev-meters-batch"] });
      setMeters({});
      setOpenings({});
      setRtts({});
      setPrices({});
      setAttendantSel({});
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to save"),
  });

  return (
    <AppLayout title="Meter Readings" subtitle="Record opening and closing meter readings per shift">
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" /> Pump Meter Readings
              </CardTitle>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save Readings"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const headers = [
                    "Pump",
                    "Product",
                    "Attendant",
                    "Opening Meter",
                    "Closing Meter",
                    "RTT (USG)",
                    "Unit Price (USD)",
                    "Volume (USG)",
                    "Total (USD)",
                  ];
                  const rows: (string | number)[][] = [];
                  let tV = 0, tS = 0, pmsV = 0, pmsS = 0, agoV = 0, agoS = 0;
                  (pumps ?? []).forEach((pump) => {
                    const ex = existingReadings?.find((r) => r.pump_id === pump.id);
                    const opening = openings[pump.id] ?? ex?.opening_meter ?? getOpeningMeter(pump.id);
                    const closingRaw = meters[pump.id] ?? ex?.closing_meter;
                    const closing = closingRaw ?? "";
                    const rtt = rtts[pump.id] ?? ex?.rtt_usg ?? 0;
                    const price = prices[pump.id] ?? ex?.unit_price_usd ?? getPrevPrice(pump.id);
                    const aId = attendantSel[pump.id] ?? ex?.attendant_id ?? "";
                    const aName = (branchAttendants ?? []).find((a) => a.id === aId)?.full_name ?? "";
                    const volume = closing !== "" ? Number(closing) - Number(opening) - Number(rtt) : 0;
                    const total = volume * Number(price);
                    if (volume > 0) {
                      tV += volume; tS += total;
                      if (pump.product_type === "PMS") { pmsV += volume; pmsS += total; }
                      else { agoV += volume; agoS += total; }
                    }
                    rows.push([
                      pump.name, pump.product_type, aName,
                      Number(opening), closing === "" ? "" : Number(closing),
                      Number(rtt), Number(price), volume, total.toFixed(2),
                    ]);
                  });
                  rows.push(["PMS Subtotal", "", "", "", "", "", "", pmsV, pmsS.toFixed(2)]);
                  rows.push(["AGO Subtotal", "", "", "", "", "", "", agoV, agoS.toFixed(2)]);
                  rows.push(["Shift Total", "", "", "", "", "", "", tV, tS.toFixed(2)]);
                  downloadCSV(
                    `meter-readings-${selectedDate}-${selectedShift.slice(0, 8)}.csv`,
                    headers,
                    rows,
                  );
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pump</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Attendant</TableHead>
                  <TableHead className="text-right">Opening Meter</TableHead>
                  <TableHead className="text-right">Closing Meter</TableHead>
                  <TableHead className="text-right">RTT (USG)</TableHead>
                  <TableHead className="text-right">Unit Price (USD)</TableHead>
                  <TableHead className="text-right">Volume (USG)</TableHead>
                  <TableHead className="text-right">Total (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let totalVolume = 0;
                  let totalSales = 0;
                  let pmsVolume = 0, pmsSales = 0, agoVolume = 0, agoSales = 0;
                  const rows = (pumps ?? []).map((pump) => {
                  const existing = existingReadings?.find((r) => r.pump_id === pump.id);
                  const carryOver = getOpeningMeter(pump.id);
                  const prevPrice = getPrevPrice(pump.id);
                  const pumpAttendants = getPumpAttendants(pump.id);
                  const opening =
                    openings[pump.id] ?? existing?.opening_meter ?? carryOver;
                  const closing = meters[pump.id] ?? existing?.closing_meter ?? "";
                  const rtt = rtts[pump.id] ?? existing?.rtt_usg ?? 0;
                  const price =
                    prices[pump.id] ?? existing?.unit_price_usd ?? prevPrice;
                  const attendantId =
                    attendantSel[pump.id] ?? existing?.attendant_id ?? "";
                  const volume =
                    closing !== "" ? Number(closing) - Number(opening) - Number(rtt) : null;
                  const total = volume !== null ? volume * Number(price) : null;
                  const isBad = volume !== null && volume <= 0;
                  if (volume !== null && !isBad) {
                    totalVolume += volume;
                    totalSales += total ?? 0;
                    if (pump.product_type === "PMS") {
                      pmsVolume += volume;
                      pmsSales += total ?? 0;
                    } else {
                      agoVolume += volume;
                      agoSales += total ?? 0;
                    }
                  }
                  return (
                    <TableRow
                      key={pump.id}
                      className={cn(isBad && "bg-destructive/10 hover:bg-destructive/15")}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isBad && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                          {pump.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", pump.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>
                          {pump.product_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={attendantId}
                          onValueChange={(v) =>
                            setAttendantSel((prev) => ({ ...prev, [pump.id]: v }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {pumpAttendants.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            className="w-28"
                            value={openings[pump.id] ?? existing?.opening_meter ?? carryOver}
                            onChange={(e) =>
                              setOpenings((prev) => ({ ...prev, [pump.id]: Number(e.target.value) }))
                            }
                            placeholder="Opening"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            title="Reset to carry-over"
                            onClick={() =>
                              setOpenings((prev) => ({ ...prev, [pump.id]: Number(carryOver) }))
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-32 ml-auto"
                          value={meters[pump.id] ?? ""}
                          onChange={(e) => setMeters((prev) => ({ ...prev, [pump.id]: Number(e.target.value) }))}
                          placeholder="Enter closing"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-24 ml-auto"
                          value={rtts[pump.id] ?? existing?.rtt_usg ?? 0}
                          onChange={(e) =>
                            setRtts((prev) => ({ ...prev, [pump.id]: Number(e.target.value) }))
                          }
                          placeholder="RTT"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-0.5">
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24"
                            value={prices[pump.id] ?? existing?.unit_price_usd ?? prevPrice}
                            onChange={(e) =>
                              setPrices((prev) => ({ ...prev, [pump.id]: Number(e.target.value) }))
                            }
                            placeholder="0.00"
                          />
                          {prices[pump.id] === undefined &&
                            existing?.unit_price_usd === undefined &&
                            prevPrice > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Carried from previous shift
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {volume !== null && (
                          <span className={cn("font-bold", isBad ? "text-destructive" : "text-foreground")}>
                            {volume.toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {total !== null ? `$${total.toFixed(2)}` : ""}
                      </TableCell>
                    </TableRow>
                  );
                  });
                  return (
                    <>
                      {rows}
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6} className="text-right text-fuel-pms font-medium">
                          PMS Subtotal
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right text-fuel-pms">
                          {pmsVolume.toLocaleString()} USG
                        </TableCell>
                        <TableCell className="text-right text-fuel-pms">
                          ${pmsSales.toFixed(2)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6} className="text-right text-fuel-ago font-medium">
                          AGO Subtotal
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right text-fuel-ago">
                          {agoVolume.toLocaleString()} USG
                        </TableCell>
                        <TableCell className="text-right text-fuel-ago">
                          ${agoSales.toFixed(2)}
                        </TableCell>
                      </TableRow>
                      <TableRow data-totals className="font-semibold bg-muted/40">
                        <TableCell colSpan={6} className="text-right">
                          Shift Totals
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right">
                          {totalVolume.toLocaleString()} USG
                        </TableCell>
                        <TableCell className="text-right">
                          ${totalSales.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Download, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { downloadCSV } from "@/lib/csv-export";
import { exportTableToPDF } from "@/lib/pdf-export";
import { buildPDFHeaderInfo } from "@/lib/pdf-header-info";
import { DailyTankDippingCard } from "@/components/dashboard/DailyTankDippingCard";

export default function ShiftStockReport() {
  const { isDealer, dealerBranchId, dealerBranchName } = useDealerBranch();
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState(dealerBranchId || "");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const branchId = isDealer ? dealerBranchId : selectedBranch;

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    enabled: !isDealer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, county, location")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: dealerBranchInfo } = useQuery({
    queryKey: ["dealer-branch-info", dealerBranchId],
    enabled: !!isDealer && !!dealerBranchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, county, location")
        .eq("id", dealerBranchId!)
        .maybeSingle();
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
    queryKey: ["tanks-report", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tanks").select("*").eq("branch_id", branchId!).eq("is_active", true).order("product_type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tankPumpAssignments } = useQuery({
    queryKey: ["tank-pump-assignments-report", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tank_pump_assignments").select("tank_id, pump_id, pumps(id, name, product_type)");
      if (error) throw error;
      return data;
    },
  });

  const { data: stockReadings } = useQuery({
    queryKey: ["stock-readings-report", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_readings").select("*").eq("branch_id", branchId!).eq("shift_id", selectedShift).eq("date", selectedDate);
      if (error) throw error;
      return data;
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["sales-report", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_sales_reports").select("*").eq("branch_id", branchId!).eq("shift_id", selectedShift).eq("date", selectedDate);
      if (error) throw error;
      return data;
    },
  });

  // Previous shift readings for opening dips
  const { data: prevReadings } = useQuery({
    queryKey: ["prev-readings-report", branchId, selectedDate, selectedShift],
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
      const { data, error } = await supabase.from("stock_readings").select("*").eq("branch_id", branchId!).eq("shift_id", prevShiftId).eq("date", prevDate);
      if (error) throw error;
      return data;
    },
  });

  // Fuel deliveries received during this shift's date (per tank) — added to Tank Sales reconciliation
  const { data: deliveries } = useQuery({
    queryKey: ["deliveries-report", branchId, selectedDate],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_deliveries")
        .select("tank_id, quantity_usg")
        .eq("branch_id", branchId!)
        .eq("delivery_date", selectedDate);
      if (error) throw error;
      return data;
    },
  });

  const reportData = useMemo(() => {
    if (!tanks) return [];
    return tanks.map((tank) => {
      const assignedPumps = tankPumpAssignments?.filter((a) => a.tank_id === tank.id).map((a) => a.pumps) ?? [];
      // Opening dip: explicit current-shift opening if present (theoretical_level_usg),
      // otherwise carry-over from previous shift's closing dip.
      const currentReading = stockReadings?.find((r) => r.tank_id === tank.id);
      const carryOver = prevReadings?.find((r) => r.tank_id === tank.id)?.physical_level_usg ?? 0;
      const explicitOpening = currentReading?.theoretical_level_usg;
      const openingDip = explicitOpening && Number(explicitOpening) > 0
        ? Number(explicitOpening)
        : Number(carryOver);
      const closingDip = Number(currentReading?.physical_level_usg ?? 0);

      // Deliveries into this tank on this date (reconciliation add-back)
      const tankDeliveries = (deliveries ?? [])
        .filter((d) => d.tank_id === tank.id)
        .reduce((s, d) => s + Number(d.quantity_usg ?? 0), 0);

      // Tank Sales (USG) = Opening Dip − Closing Dip + Deliveries
      const tankSales = openingDip - closingDip + tankDeliveries;

      const pumpDetails = assignedPumps.map((pump: any) => {
        const sale = salesData?.find((s) => s.pump_id === pump?.id);
        const openingMeter = Number(sale?.opening_meter ?? 0);
        const closingMeter = Number(sale?.closing_meter ?? 0);
        const rtt = Number(sale?.rtt_usg ?? 0);
        // Meter Sales = Closing − Opening − RTT
        const meterSales = closingMeter - openingMeter - rtt;
        return {
          name: pump?.name ?? "Unknown",
          openingMeter,
          closingMeter,
          meterSales,
        };
      });

      const totalMeterSales = pumpDetails.reduce((s, p) => s + p.meterSales, 0);
      // Variance = Tank Sales (USG) − Meter Sales
      const variance = tankSales - totalMeterSales;

      return {
        tankName: tank.name,
        productType: tank.product_type,
        capacity: Number(tank.capacity_usg),
        openingDip,
        closingDip,
        deliveries: tankDeliveries,
        tankSales,
        pumps: pumpDetails,
        totalMeterSales,
        variance,
      };
    });
  }, [tanks, tankPumpAssignments, stockReadings, salesData, prevReadings, deliveries]);

  const shiftName = shifts?.find((s) => s.id === selectedShift)?.name ?? "";
  const branchName = isDealer ? dealerBranchName : branches?.find((b) => b.id === selectedBranch)?.name ?? "";

  return (
    <AppLayout title="Shift Stock Report" subtitle="Tank dips, meter readings, sales & variance per shift">
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
                <SelectContent>{shifts?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const rows = reportData.flatMap((t) =>
                  t.pumps.length > 0
                    ? t.pumps.map((p) => [t.tankName, t.productType, t.openingDip, t.closingDip, t.deliveries, t.tankSales, p.name, p.openingMeter, p.closingMeter, p.meterSales, t.variance])
                    : [[t.tankName, t.productType, t.openingDip, t.closingDip, t.deliveries, t.tankSales, "—", 0, 0, 0, t.variance]]
                );
                downloadCSV(`shift-stock-report-${selectedDate}-${shiftName}.csv`,
                  ["Tank", "Product", "Opening Dip", "Closing Dip", "Deliveries", "Tank Sales", "Pump", "Opening Meter", "Closing Meter", "Meter Sales", "Variance"],
                  rows
                );
              }}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                const branch = isDealer
                  ? dealerBranchInfo
                  : branches?.find((b) => b.id === selectedBranch);
                const headerInfo = await buildPDFHeaderInfo(branch);
                const rows = reportData.flatMap((t) =>
                  t.pumps.length > 0
                    ? t.pumps.map((p) => [
                        t.tankName, t.productType,
                        t.openingDip.toLocaleString(), t.closingDip.toLocaleString(),
                        t.deliveries.toLocaleString(),
                        t.tankSales.toLocaleString(),
                        p.name,
                        Number(p.openingMeter).toLocaleString(),
                        Number(p.closingMeter).toLocaleString(),
                        p.meterSales.toLocaleString(),
                        `${t.variance >= 0 ? "+" : ""}${t.variance.toLocaleString()}`,
                      ])
                    : [[t.tankName, t.productType, t.openingDip.toLocaleString(), t.closingDip.toLocaleString(), t.deliveries.toLocaleString(), t.tankSales.toLocaleString(), "—", "0", "0", "0", `${t.variance >= 0 ? "+" : ""}${t.variance.toLocaleString()}`]]
                );
                const totalVariance = reportData.reduce((s, t) => s + t.variance, 0);
                exportTableToPDF(
                  "Shift Stock Report",
                  `${shiftName} Shift • ${format(new Date(selectedDate), "MMMM dd, yyyy")}`,
                  ["Tank", "Product", "Opening Dip", "Closing Dip", "Deliveries", "Tank Sales", "Pump", "Opening Meter", "Closing Meter", "Meter Sales", "Variance"],
                  rows,
                  [
                    { label: "Tanks", value: String(reportData.length) },
                    { label: "Total Deliveries", value: `${reportData.reduce((s, t) => s + t.deliveries, 0).toLocaleString()} USG` },
                    { label: "Total Tank Sales", value: `${reportData.reduce((s, t) => s + t.tankSales, 0).toLocaleString()} USG` },
                    { label: "Total Meter Sales", value: `${reportData.reduce((s, t) => s + t.totalMeterSales, 0).toLocaleString()} USG` },
                    { label: "Net Variance", value: `${totalVariance >= 0 ? "+" : ""}${totalVariance.toLocaleString()} USG` },
                  ],
                  headerInfo,
                  user?.profile?.full_name ?? user?.email ?? undefined,
                );
              }}>
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {branchId && (
        <DailyTankDippingCard
          branchId={branchId}
          branchName={branchName}
          endDate={selectedDate}
          days={7}
        />
      )}

      {branchId && selectedShift && (
        <>
          <div className="text-center mb-4 print:mb-2">
            <h2 className="text-lg font-bold">{branchName} — Shift Stock Report</h2>
            <p className="text-sm text-muted-foreground">{format(new Date(selectedDate), "MMMM dd, yyyy")} · {shiftName} Shift</p>
          </div>

          {["PMS", "AGO"].map((product) => {
            const productTanks = reportData.filter((t) => t.productType === product);
            if (productTanks.length === 0) return null;
            return (
              <Card key={product} className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-sm", product === "PMS" ? "border-fuel-pms text-fuel-pms bg-fuel-pms/10" : "border-fuel-ago text-fuel-ago bg-fuel-ago/10")}>
                      {product}
                    </Badge>
                    {product === "PMS" ? "Premium Motor Spirit" : "Automotive Gas Oil"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tank</TableHead>
                        <TableHead className="text-right">Opening Dip</TableHead>
                        <TableHead className="text-right">Closing Dip</TableHead>
                        <TableHead className="text-right">Deliveries</TableHead>
                        <TableHead className="text-right">Tank Sales</TableHead>
                        <TableHead>Pump</TableHead>
                        <TableHead className="text-right">Opening Meter</TableHead>
                        <TableHead className="text-right">Closing Meter</TableHead>
                        <TableHead className="text-right">Meter Sales</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productTanks.map((tank) =>
                        tank.pumps.length > 0 ? (
                          tank.pumps.map((pump, idx) => (
                            <TableRow key={`${tank.tankName}-${pump.name}`}>
                              {idx === 0 && (
                                <>
                                  <TableCell rowSpan={tank.pumps.length} className="font-medium align-top">{tank.tankName}</TableCell>
                                  <TableCell rowSpan={tank.pumps.length} className="text-right align-top">{tank.openingDip.toLocaleString()}</TableCell>
                                  <TableCell rowSpan={tank.pumps.length} className="text-right align-top">{tank.closingDip.toLocaleString()}</TableCell>
                                  <TableCell rowSpan={tank.pumps.length} className={cn("text-right align-top", tank.deliveries > 0 ? "text-primary font-medium" : "text-muted-foreground")}>
                                    {tank.deliveries > 0 ? `+${tank.deliveries.toLocaleString()}` : "—"}
                                  </TableCell>
                                  <TableCell rowSpan={tank.pumps.length} className="text-right align-top font-medium">{tank.tankSales.toLocaleString()}</TableCell>
                                </>
                              )}
                              <TableCell>{pump.name}</TableCell>
                              <TableCell className="text-right">{Number(pump.openingMeter).toLocaleString()}</TableCell>
                              <TableCell className="text-right">{Number(pump.closingMeter).toLocaleString()}</TableCell>
                              <TableCell className="text-right font-medium">{pump.meterSales.toLocaleString()}</TableCell>
                              {idx === 0 && (
                                <TableCell rowSpan={tank.pumps.length} className={cn("text-right font-bold align-top", tank.variance === 0 ? "text-success" : "text-destructive")}>
                                  {tank.variance >= 0 ? "+" : ""}{tank.variance.toLocaleString()}
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow key={tank.tankName}>
                            <TableCell className="font-medium">{tank.tankName}</TableCell>
                            <TableCell className="text-right">{tank.openingDip.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{tank.closingDip.toLocaleString()}</TableCell>
                            <TableCell className={cn("text-right", tank.deliveries > 0 ? "text-primary font-medium" : "text-muted-foreground")}>
                              {tank.deliveries > 0 ? `+${tank.deliveries.toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">{tank.tankSales.toLocaleString()}</TableCell>
                            <TableCell colSpan={3} className="text-center text-muted-foreground text-sm">No pumps assigned</TableCell>
                            <TableCell className="text-right">—</TableCell>
                            <TableCell className="text-right">—</TableCell>
                          </TableRow>
                        )
                      )}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Total {product}</TableCell>
                        <TableCell className="text-right">{productTanks.reduce((s, t) => s + t.openingDip, 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{productTanks.reduce((s, t) => s + t.closingDip, 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{productTanks.reduce((s, t) => s + t.deliveries, 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{productTanks.reduce((s, t) => s + t.tankSales, 0).toLocaleString()}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                        <TableCell className="text-right">{productTanks.reduce((s, t) => s + t.totalMeterSales, 0).toLocaleString()}</TableCell>
                        <TableCell className={cn("text-right", productTanks.reduce((s, t) => s + t.variance, 0) === 0 ? "text-success" : "text-destructive")}>
                          {productTanks.reduce((s, t) => s + t.variance, 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </AppLayout>
  );
}

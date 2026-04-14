import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { useMeterCarryOver } from "@/hooks/useMeterCarryOver";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gauge, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function MeterReading() {
  const { user } = useAuth();
  const { isDealer, dealerBranchId } = useDealerBranch();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState(dealerBranchId || "");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meters, setMeters] = useState<Record<string, number>>({});

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

  const { getCarryOverMeter } = useMeterCarryOver(branchId || "", selectedDate, selectedShift);

  const { data: existingReadings } = useQuery({
    queryKey: ["existing-meter-readings", branchId, selectedDate, selectedShift],
    enabled: !!branchId && !!selectedShift,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_sales_reports")
        .select("pump_id, opening_meter, closing_meter")
        .eq("branch_id", branchId!)
        .eq("shift_id", selectedShift)
        .eq("date", selectedDate);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!branchId || !selectedShift) throw new Error("Select branch and shift");
      const entries = (pumps ?? [])
        .filter((p) => meters[p.id] !== undefined)
        .map((p) => {
          const opening = existingReadings?.find((r) => r.pump_id === p.id)?.opening_meter ?? getCarryOverMeter(p.id) ?? 0;
          return {
            branch_id: branchId,
            pump_id: p.id,
            shift_id: selectedShift,
            date: selectedDate,
            opening_meter: opening,
            closing_meter: meters[p.id],
            created_by: user?.id,
          };
        });
      if (entries.length === 0) throw new Error("Enter at least one meter reading");
      const { error } = await supabase.from("shift_sales_reports").upsert(entries, { onConflict: "branch_id,pump_id,shift_id,date" as any });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meter readings saved");
      queryClient.invalidateQueries({ queryKey: ["existing-meter-readings"] });
      setMeters({});
    },
    onError: (err: Error) => toast.error(err.message),
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" /> Pump Meter Readings
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
                  <TableHead>Pump</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Opening Meter</TableHead>
                  <TableHead className="text-right">Closing Meter</TableHead>
                  <TableHead className="text-right">Volume (USG)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pumps ?? []).map((pump) => {
                  const existing = existingReadings?.find((r) => r.pump_id === pump.id);
                  const opening = existing?.opening_meter ?? getCarryOverMeter(pump.id) ?? 0;
                  const closing = meters[pump.id] ?? existing?.closing_meter ?? "";
                  const volume = closing !== "" ? Number(closing) - opening : null;
                  return (
                    <TableRow key={pump.id}>
                      <TableCell className="font-medium">{pump.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", pump.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>
                          {pump.product_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{Number(opening).toLocaleString()}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-32 ml-auto"
                          value={meters[pump.id] ?? ""}
                          onChange={(e) => setMeters((prev) => ({ ...prev, [pump.id]: Number(e.target.value) }))}
                          placeholder="Enter closing"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {volume !== null && (
                          <span className={cn("font-bold", volume >= 0 ? "text-foreground" : "text-destructive")}>
                            {volume.toLocaleString()}
                          </span>
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

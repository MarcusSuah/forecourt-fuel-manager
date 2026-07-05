import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchSelect, useShiftSelect } from "@/hooks/useDealerBranch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Save, Receipt, Calculator, Download, User } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { usgToLiters } from "@/lib/units";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { enqueue as enqueueSync, isOffline } from "@/lib/sync-queue";

const MAX_PUMPS_PER_ATTENDANT = 4;

interface PumpEntry {
  key: string;
  pump_id: string;
  opening_meter: string;
  closing_meter: string;
  rtt_usg: string;
  unit_price_usd: string;
}

export default function SalesEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { selectedBranch: globalBranch, setSelectedBranch: setGlobalBranch, isBranchDisabled } = useBranchSelect();
  const { shifts, selectedShift: globalShift, setSelectedShift: setGlobalShift } = useShiftSelect();
  const [selectedAttendant, setSelectedAttendant] = useState("");
  const [pumpEntries, setPumpEntries] = useState<PumpEntry[]>([]);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendants — exclude those linked to inactive employees
  const { data: attendants } = useQuery({
    queryKey: ["attendants-with-emp", globalBranch],
    enabled: !!globalBranch,
    queryFn: async () => {
      const { data: atts, error } = await supabase
        .from("attendants")
        .select("id, full_name, employee_id, phone, user_id")
        .eq("branch_id", globalBranch!)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      // Fetch employees with non-active status for this branch to exclude them
      const { data: inactiveEmps } = await supabase
        .from("employees")
        .select("full_name")
        .eq("branch_id", globalBranch!)
        .neq("employment_status", "active");
      const inactiveNames = new Set((inactiveEmps ?? []).map(e => e.full_name.toLowerCase()));
      return (atts ?? []).filter(a => !inactiveNames.has(a.full_name.toLowerCase()));
    },
  });

  const { data: pumps } = useQuery({
    queryKey: ["pumps", globalBranch],
    enabled: !!globalBranch,
    queryFn: async () => {
      const { data, error } = await supabase.from("pumps").select("id, name, product_type, island_id").eq("branch_id", globalBranch!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Get pumps already assigned (have sales entries) for this date+shift+branch
  const { data: assignedPumps } = useQuery({
    queryKey: ["assigned-pumps", date, globalBranch, globalShift],
    enabled: !!globalBranch && !!globalShift,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_sales_reports")
        .select("pump_id, attendant_id")
        .eq("date", date)
        .eq("branch_id", globalBranch!)
        .eq("shift_id", globalShift);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: todaysEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ["sales-entries", date, globalBranch, globalShift],
    enabled: !!globalBranch && !!globalShift,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_sales_reports")
        .select("*, attendants(full_name), pumps(name, product_type), islands(island_number)")
        .eq("date", date)
        .eq("branch_id", globalBranch!)
        .eq("shift_id", globalShift)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedAttendantData = useMemo(
    () => attendants?.find(a => a.id === selectedAttendant),
    [attendants, selectedAttendant]
  );

  // Pumps already taken by OTHER attendants for this shift (or by this attendant already submitted)
  const takenPumpIds = useMemo(() => {
    const taken = new Set<string>();
    assignedPumps?.forEach(ap => taken.add(ap.pump_id));
    // Also exclude pumps already in current form entries
    pumpEntries.forEach(pe => { if (pe.pump_id) taken.add(pe.pump_id); });
    return taken;
  }, [assignedPumps, pumpEntries]);

  // Available pumps for dropdown: not taken by anyone in this shift
  const getAvailablePumps = useCallback((currentPumpId: string) => {
    return (pumps ?? []).filter(p => p.id === currentPumpId || !takenPumpIds.has(p.id));
  }, [pumps, takenPumpIds]);

  // Count how many pumps this attendant already has (submitted + current form)
  const attendantPumpCount = useMemo(() => {
    const submittedCount = assignedPumps?.filter(ap => ap.attendant_id === selectedAttendant).length ?? 0;
    return submittedCount + pumpEntries.length;
  }, [assignedPumps, selectedAttendant, pumpEntries]);

  const canAddMorePumps = attendantPumpCount < MAX_PUMPS_PER_ATTENDANT;

  // When attendant changes, reset pump entries
  useEffect(() => {
    setPumpEntries([]);
  }, [selectedAttendant]);

  const addPumpEntry = () => {
    if (!canAddMorePumps) {
      toast.error(`Max ${MAX_PUMPS_PER_ATTENDANT} pumps per attendant`);
      return;
    }
    setPumpEntries(prev => [...prev, {
      key: crypto.randomUUID(),
      pump_id: "",
      opening_meter: "",
      closing_meter: "",
      rtt_usg: "0",
      unit_price_usd: "",
    }]);
  };

  const updateEntry = (key: string, field: keyof PumpEntry, value: string) => {
    setPumpEntries(prev => prev.map(e => e.key === key ? { ...e, [field]: value } : e));
  };

  const removeEntry = (key: string) => {
    setPumpEntries(prev => prev.filter(e => e.key !== key));
  };

  const handlePumpSelect = useCallback(async (key: string, pumpId: string) => {
    updateEntry(key, "pump_id", pumpId);
    if (!pumpId || !date || !globalBranch || !globalShift) return;
    try {
      const { data: allShifts } = await supabase.from("shifts").select("id, start_time").order("start_time");
      if (!allShifts) return;
      const currentIdx = allShifts.findIndex(s => s.id === globalShift);
      let carryOverMeter: number | null = null;

      if (currentIdx > 0) {
        const prevShift = allShifts[currentIdx - 1];
        const { data } = await supabase
          .from("shift_sales_reports")
          .select("closing_meter")
          .eq("pump_id", pumpId).eq("date", date).eq("shift_id", prevShift.id).eq("branch_id", globalBranch!)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) carryOverMeter = Number(data.closing_meter);
      }

      if (carryOverMeter === null) {
        const { data } = await supabase
          .from("shift_sales_reports")
          .select("closing_meter")
          .eq("pump_id", pumpId).eq("branch_id", globalBranch!).lte("date", date)
          .order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) carryOverMeter = Number(data.closing_meter);
      }

      if (carryOverMeter !== null) {
        updateEntry(key, "opening_meter", carryOverMeter.toString());
      }
    } catch (err) {
      console.error("Failed to fetch carry-over meter:", err);
    }
  }, [date, globalBranch, globalShift]);

  const calcSales = (entry: PumpEntry) => {
    const open = parseFloat(entry.opening_meter) || 0;
    const close = parseFloat(entry.closing_meter) || 0;
    const rtt = parseFloat(entry.rtt_usg) || 0;
    const price = parseFloat(entry.unit_price_usd) || 0;
    const salesUsg = close - open - rtt;
    const salesLiters = usgToLiters(salesUsg);
    const totalUsd = salesUsg * price;
    return { salesUsg, salesLiters, totalUsd };
  };

  const grandTotal = useMemo(() => pumpEntries.reduce((sum, e) => sum + calcSales(e).totalUsd, 0), [pumpEntries]);

  // Unsaved-changes guard: any pump entry rows with content count as unsaved
  const hasUnsavedChanges = useMemo(() => {
    return pumpEntries.some(e =>
      e.pump_id || e.opening_meter || e.closing_meter || e.unit_price_usd ||
      (e.rtt_usg && e.rtt_usg !== "0")
    );
  }, [pumpEntries]);
  const { dialogProps } = useUnsavedChangesGuard(
    hasUnsavedChanges,
    "You have unsaved sales entries. Leave without submitting?"
  );

  const canSubmit = globalBranch && globalShift && selectedAttendant && pumpEntries.length > 0 && pumpEntries.every(
    e => e.pump_id && e.closing_meter && e.unit_price_usd &&
      parseFloat(e.closing_meter) >= parseFloat(e.opening_meter || "0")
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const inserts = pumpEntries.map(e => ({
        branch_id: globalBranch,
        shift_id: globalShift,
        date,
        attendant_id: selectedAttendant,
        pump_id: e.pump_id,
        opening_meter: parseFloat(e.opening_meter) || 0,
        closing_meter: parseFloat(e.closing_meter) || 0,
        rtt_usg: parseFloat(e.rtt_usg) || 0,
        unit_price_usd: parseFloat(e.unit_price_usd) || 0,
        created_by: user?.id,
      }));
      const branchName = branches?.find(b => b.id === globalBranch)?.name ?? "branch";
      const attName = selectedAttendantData?.full_name ?? "attendant";
      const label = `Sales: ${inserts.length} pump${inserts.length === 1 ? "" : "s"} · ${attName} · ${branchName}`;

      if (isOffline()) {
        enqueueSync({ table: "shift_sales_reports", rows: inserts, label });
        return { queued: true as const };
      }
      try {
        const { error } = await supabase.from("shift_sales_reports").insert(inserts);
        if (error) throw error;
        return { queued: false as const };
      } catch (err: any) {
        const msg = String(err?.message ?? err).toLowerCase();
        const isNetwork = msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
        if (isNetwork) {
          enqueueSync({ table: "shift_sales_reports", rows: inserts, label });
          return { queued: true as const };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if (result?.queued) {
        toast.success("Saved offline — will sync when you reconnect");
      } else {
        toast.success("Sales entries submitted successfully");
      }
      setPumpEntries([]);
      setSelectedAttendant("");
      queryClient.invalidateQueries({ queryKey: ["sales-entries"] });
      queryClient.invalidateQueries({ queryKey: ["assigned-pumps"] });
    },
    onError: (err: Error) => toast.error("Failed to submit: " + err.message),
  });

  return (
    <AppLayout title="Attendant Sales Entry" subtitle="Record pump meter readings and calculate sales per shift">
      <UnsavedChangesDialog {...dialogProps} />
      {/* Shift Details */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-primary" /> Shift Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Station / Branch *</Label>
              <Select value={globalBranch} onValueChange={v => { setGlobalBranch(v); setSelectedAttendant(""); setPumpEntries([]); }} disabled={isBranchDisabled}>
                <SelectTrigger className={isBranchDisabled ? "opacity-70" : ""}><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>{branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift *</Label>
              <Select value={globalShift} onValueChange={v => { setGlobalShift(v); setSelectedAttendant(""); setPumpEntries([]); }}>
                <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>{shifts?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grand Total</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-primary/10 border border-primary/30">
                <span className="font-bold text-primary text-lg">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendant Selection */}
      {globalBranch && globalShift && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" /> Select Attendant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Attendant Name *</Label>
                <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
                  <SelectTrigger><SelectValue placeholder="Select attendant" /></SelectTrigger>
                  <SelectContent>
                    {attendants?.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedAttendantData && (
                <>
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input value={selectedAttendantData.employee_id || "—"} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={selectedAttendantData.phone || "—"} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Pumps Assigned</Label>
                    <div className="h-10 flex items-center px-3 rounded-md bg-muted border">
                      <span className="font-medium">{attendantPumpCount} / {MAX_PUMPS_PER_ATTENDANT}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meter Readings */}
      {globalBranch && globalShift && selectedAttendant && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-5 w-5 text-primary" /> Meter Readings — {selectedAttendantData?.full_name}
              </CardTitle>
              <Button onClick={addPumpEntry} size="sm" variant="outline" disabled={!canAddMorePumps}>
                + Assign Pump ({pumpEntries.length}/{MAX_PUMPS_PER_ATTENDANT - (assignedPumps?.filter(ap => ap.attendant_id === selectedAttendant).length ?? 0)})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto -mx-6 px-6">
            {pumpEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Click "Assign Pump" to add pump meter readings for this attendant
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Pump *</TableHead>
                    <TableHead className="min-w-[80px]">Product</TableHead>
                    <TableHead className="min-w-[100px]">Open Meter</TableHead>
                    <TableHead className="min-w-[100px]">Close Meter *</TableHead>
                    <TableHead className="min-w-[80px]">RTT</TableHead>
                    <TableHead className="min-w-[80px]">Sales USG</TableHead>
                    <TableHead className="min-w-[80px]">Sales L</TableHead>
                    <TableHead className="min-w-[80px]">Price *</TableHead>
                    <TableHead className="min-w-[90px]">Total $</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pumpEntries.map(entry => {
                    const { salesUsg, salesLiters, totalUsd } = calcSales(entry);
                    const availPumps = getAvailablePumps(entry.pump_id);
                    const selectedPump = pumps?.find(p => p.id === entry.pump_id);
                    return (
                      <TableRow key={entry.key}>
                        <TableCell>
                          <Select value={entry.pump_id} onValueChange={v => handlePumpSelect(entry.key, v)}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select pump" /></SelectTrigger>
                            <SelectContent>
                              {availPumps.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {selectedPump && (
                            <Badge variant="outline" className={cn("text-[10px]", selectedPump.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>
                              {selectedPump.product_type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={entry.opening_meter} onChange={e => updateEntry(entry.key, "opening_meter", e.target.value)} placeholder="0.00" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={entry.closing_meter} onChange={e => updateEntry(entry.key, "closing_meter", e.target.value)} placeholder="0.00" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={entry.rtt_usg} onChange={e => updateEntry(entry.key, "rtt_usg", e.target.value)} placeholder="0" />
                        </TableCell>
                        <TableCell><span className={cn("font-semibold text-xs", salesUsg < 0 ? "text-destructive" : "")}>{salesUsg.toFixed(2)}</span></TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{salesLiters.toFixed(2)}</span></TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={entry.unit_price_usd} onChange={e => updateEntry(entry.key, "unit_price_usd", e.target.value)} placeholder="$0.00" />
                        </TableCell>
                        <TableCell><span className="font-bold text-xs text-primary">${totalUsd.toFixed(2)}</span></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeEntry(entry.key)}>
                            ✕
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {pumpEntries.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => { if (canSubmit) submitMutation.mutate(); else toast.error("Fill all required fields"); }} disabled={!canSubmit || submitMutation.isPending} size="sm">
                  <Save className="h-4 w-4 mr-2" /> {submitMutation.isPending ? "Submitting..." : "Submit Entries"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submitted entries */}
      {globalBranch && globalShift && todaysEntries && todaysEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Submitted — {format(new Date(date), "MMM dd, yyyy")}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                downloadCSV(`sales-${date}.csv`,
                  ["Attendant", "Pump", "Product", "Open", "Close", "RTT", "Sales USG", "Sales L", "Price", "Total $"],
                  todaysEntries.map(e => [(e.attendants as any)?.full_name, (e.pumps as any)?.name, (e.pumps as any)?.product_type, Number(e.opening_meter), Number(e.closing_meter), Number(e.rtt_usg), Number(e.sales_usg), Number(e.sales_liters), Number(e.unit_price_usd), Number(e.total_sales_usd)])
                );
              }}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendant</TableHead>
                  <TableHead>Pump</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Close</TableHead>
                  <TableHead className="text-right">Sales USG</TableHead>
                  <TableHead className="text-right">Total $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaysEntries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{(e.attendants as any)?.full_name}</TableCell>
                    <TableCell>{(e.pumps as any)?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", (e.pumps as any)?.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>{(e.pumps as any)?.product_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(e.opening_meter).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(e.closing_meter).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{Number(e.sales_usg).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">${Number(e.total_sales_usd).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}

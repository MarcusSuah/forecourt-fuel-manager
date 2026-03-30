import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Save, Trash2, Receipt, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SalesRow {
  key: string;
  branch_id: string;
  shift_id: string;
  attendant_id: string;
  island_id: string;
  pump_id: string;
  opening_meter: string;
  closing_meter: string;
  rtt_usg: string;
  unit_price_usd: string;
}

const emptyRow = (): SalesRow => ({
  key: crypto.randomUUID(),
  branch_id: "",
  shift_id: "",
  attendant_id: "",
  island_id: "",
  pump_id: "",
  opening_meter: "",
  closing_meter: "",
  rtt_usg: "0",
  unit_price_usd: "",
});

export default function SalesEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rows, setRows] = useState<SalesRow[]>([emptyRow()]);
  const [globalBranch, setGlobalBranch] = useState("");
  const [globalShift, setGlobalShift] = useState("");

  const { data: branches } = useQuery({
    queryKey: ["branches"],
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

  const { data: attendants } = useQuery({
    queryKey: ["attendants", globalBranch],
    enabled: !!globalBranch,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendants").select("id, full_name, employee_id").eq("branch_id", globalBranch).eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: islands } = useQuery({
    queryKey: ["islands", globalBranch],
    enabled: !!globalBranch,
    queryFn: async () => {
      const { data, error } = await supabase.from("islands").select("id, island_number").eq("branch_id", globalBranch).eq("is_active", true).order("island_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: pumps } = useQuery({
    queryKey: ["pumps", globalBranch],
    enabled: !!globalBranch,
    queryFn: async () => {
      const { data, error } = await supabase.from("pumps").select("id, name, product_type, island_id").eq("branch_id", globalBranch).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
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
        .eq("branch_id", globalBranch)
        .eq("shift_id", globalShift)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (entries: SalesRow[]) => {
      const inserts = entries.map((r) => ({
        branch_id: globalBranch,
        shift_id: globalShift,
        date,
        attendant_id: r.attendant_id,
        island_id: r.island_id || null,
        pump_id: r.pump_id,
        opening_meter: parseFloat(r.opening_meter) || 0,
        closing_meter: parseFloat(r.closing_meter) || 0,
        rtt_usg: parseFloat(r.rtt_usg) || 0,
        unit_price_usd: parseFloat(r.unit_price_usd) || 0,
        created_by: user?.id,
      }));
      const { error } = await supabase.from("shift_sales_reports").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sales entries submitted successfully");
      setRows([emptyRow()]);
      queryClient.invalidateQueries({ queryKey: ["sales-entries"] });
    },
    onError: (err: Error) => {
      toast.error("Failed to submit: " + err.message);
    },
  });

  const updateRow = (key: string, field: keyof SalesRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (key: string) => setRows((prev) => prev.length > 1 ? prev.filter((r) => r.key !== key) : prev);

  const calcSales = (row: SalesRow) => {
    const open = parseFloat(row.opening_meter) || 0;
    const close = parseFloat(row.closing_meter) || 0;
    const rtt = parseFloat(row.rtt_usg) || 0;
    const price = parseFloat(row.unit_price_usd) || 0;
    const salesUsg = close - open - rtt;
    const salesLiters = salesUsg * 3.78541;
    const totalUsd = salesUsg * price;
    return { salesUsg, salesLiters, totalUsd };
  };

  const grandTotal = useMemo(
    () => rows.reduce((sum, r) => sum + calcSales(r).totalUsd, 0),
    [rows]
  );

  const canSubmit = globalBranch && globalShift && rows.every(
    (r) => r.attendant_id && r.pump_id && r.closing_meter && r.unit_price_usd &&
      parseFloat(r.closing_meter) >= parseFloat(r.opening_meter || "0")
  );

  const getPumpsForIsland = (islandId: string) => {
    if (!islandId) return pumps ?? [];
    return (pumps ?? []).filter((p) => p.island_id === islandId);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error("Please fill all required fields and ensure closing > opening meter");
      return;
    }
    submitMutation.mutate(rows);
  };

  return (
    <AppLayout title="Attendant Sales Entry" subtitle="Record pump meter readings and calculate sales per shift">
      {/* Global Controls */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-primary" />
            Shift Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Station / Branch *</Label>
              <Select value={globalBranch} onValueChange={(v) => { setGlobalBranch(v); setRows([emptyRow()]); }}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift *</Label>
              <Select value={globalShift} onValueChange={setGlobalShift}>
                <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>
                  {shifts?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</SelectItem>
                  ))}
                </SelectContent>
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

      {/* Entry Rows */}
      {globalBranch && globalShift && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-5 w-5 text-primary" />
                Meter Readings
              </CardTitle>
              <Button onClick={addRow} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add Row
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Attendant *</TableHead>
                  <TableHead className="min-w-[100px]">Island</TableHead>
                  <TableHead className="min-w-[120px]">Pump *</TableHead>
                  <TableHead className="min-w-[110px]">Opening Meter</TableHead>
                  <TableHead className="min-w-[110px]">Closing Meter *</TableHead>
                  <TableHead className="min-w-[90px]">RTT (USG)</TableHead>
                  <TableHead className="min-w-[90px]">Sales (USG)</TableHead>
                  <TableHead className="min-w-[90px]">Sales (L)</TableHead>
                  <TableHead className="min-w-[100px]">Price/USG *</TableHead>
                  <TableHead className="min-w-[110px]">Total ($)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const { salesUsg, salesLiters, totalUsd } = calcSales(row);
                  const availPumps = getPumpsForIsland(row.island_id);
                  const selectedPump = pumps?.find((p) => p.id === row.pump_id);

                  return (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Select value={row.attendant_id} onValueChange={(v) => updateRow(row.key, "attendant_id", v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {attendants?.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.island_id} onValueChange={(v) => { updateRow(row.key, "island_id", v); updateRow(row.key, "pump_id", ""); }}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_islands">All Islands</SelectItem>
                            {islands?.map((i) => (
                              <SelectItem key={i.id} value={i.id}>Island {i.island_number}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.pump_id} onValueChange={(v) => updateRow(row.key, "pump_id", v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {availPumps.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedPump && (
                          <Badge variant="outline" className={cn("mt-1 text-[10px]", selectedPump.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>
                            {selectedPump.product_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={row.opening_meter} onChange={(e) => updateRow(row.key, "opening_meter", e.target.value)} placeholder="0.00" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={row.closing_meter} onChange={(e) => updateRow(row.key, "closing_meter", e.target.value)} placeholder="0.00" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={row.rtt_usg} onChange={(e) => updateRow(row.key, "rtt_usg", e.target.value)} placeholder="0" />
                      </TableCell>
                      <TableCell>
                        <span className={cn("font-semibold text-sm", salesUsg < 0 ? "text-destructive" : "text-foreground")}>
                          {salesUsg.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{salesLiters.toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={row.unit_price_usd} onChange={(e) => updateRow(row.key, "unit_price_usd", e.target.value)} placeholder="$0.00" />
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-sm text-primary">${totalUsd.toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeRow(row.key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <Button onClick={addRow} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Another Row
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || submitMutation.isPending} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? "Submitting..." : "Submit Entries"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Submitted Entries */}
      {globalBranch && globalShift && todaysEntries && todaysEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submitted Entries for {format(new Date(date), "MMM dd, yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendant</TableHead>
                  <TableHead>Pump</TableHead>
                  <TableHead>Island</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead className="text-right">RTT</TableHead>
                  <TableHead className="text-right">Sales (USG)</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaysEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{(entry.attendants as any)?.full_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(entry.pumps as any)?.name}
                        <Badge variant="outline" className={cn("text-[10px]", (entry.pumps as any)?.product_type === "PMS" ? "border-fuel-pms text-fuel-pms" : "border-fuel-ago text-fuel-ago")}>
                          {(entry.pumps as any)?.product_type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{(entry.islands as any)?.island_number ? `Island ${(entry.islands as any).island_number}` : "—"}</TableCell>
                    <TableCell className="text-right">{Number(entry.opening_meter).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(entry.closing_meter).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(entry.rtt_usg).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(entry.sales_usg).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(entry.unit_price_usd).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">${Number(entry.total_sales_usd).toFixed(2)}</TableCell>
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

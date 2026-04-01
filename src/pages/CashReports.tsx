import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, Save, Trash2, Wallet, DollarSign, Banknote, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface DepositRow {
  key: string;
  attendant_id: string;
  deposit_type: string;
  amount: string;
  exchange_rate: string;
  notes: string;
}

const emptyRow = (exchangeRate: string): DepositRow => ({
  key: crypto.randomUUID(),
  attendant_id: "",
  deposit_type: "",
  amount: "",
  exchange_rate: exchangeRate,
  notes: "",
});

export default function CashReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [globalBranch, setGlobalBranch] = useState("");
  const [globalShift, setGlobalShift] = useState("");
  const [defaultExchangeRate, setDefaultExchangeRate] = useState("192");
  const [rows, setRows] = useState<DepositRow[]>([emptyRow("192")]);

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
      const { data, error } = await supabase.from("attendants").select("id, full_name").eq("branch_id", globalBranch).eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: todaysDeposits } = useQuery({
    queryKey: ["cash-deposits", date, globalBranch, globalShift],
    enabled: !!globalBranch && !!globalShift,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_deposits")
        .select("*, attendants(full_name)")
        .eq("date", date)
        .eq("branch_id", globalBranch)
        .eq("shift_id", globalShift)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (entries: DepositRow[]) => {
      const inserts = entries.map((r) => ({
        branch_id: globalBranch,
        shift_id: globalShift,
        date,
        attendant_id: r.attendant_id || null,
        deposit_type: r.deposit_type,
        amount: parseFloat(r.amount) || 0,
        exchange_rate: r.deposit_type === "LRD" ? parseFloat(r.exchange_rate) || 1 : 1,
        notes: r.notes || null,
        created_by: user?.id,
      }));
      const { error } = await supabase.from("cash_deposits").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cash deposits recorded successfully");
      setRows([emptyRow(defaultExchangeRate)]);
      queryClient.invalidateQueries({ queryKey: ["cash-deposits"] });
    },
    onError: (err: Error) => toast.error("Failed: " + err.message),
  });

  const updateRow = (key: string, field: keyof DepositRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow(defaultExchangeRate)]);
  const removeRow = (key: string) => setRows((prev) => prev.length > 1 ? prev.filter((r) => r.key !== key) : prev);

  const calcUsd = (row: DepositRow) => {
    const amt = parseFloat(row.amount) || 0;
    if (row.deposit_type === "LRD") {
      const rate = parseFloat(row.exchange_rate) || 1;
      return amt / rate;
    }
    return amt;
  };

  const totals = useMemo(() => {
    const lrd = rows.filter(r => r.deposit_type === "LRD").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const usd = rows.filter(r => r.deposit_type === "USD").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const card = rows.filter(r => r.deposit_type === "card").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalUsd = rows.reduce((s, r) => s + calcUsd(r), 0);
    return { lrd, usd, card, totalUsd };
  }, [rows]);

  const submittedTotals = useMemo(() => {
    if (!todaysDeposits) return { lrd: 0, usd: 0, card: 0, totalUsd: 0 };
    const lrd = todaysDeposits.filter(d => d.deposit_type === "LRD").reduce((s, d) => s + Number(d.amount), 0);
    const usd = todaysDeposits.filter(d => d.deposit_type === "USD").reduce((s, d) => s + Number(d.amount), 0);
    const card = todaysDeposits.filter(d => d.deposit_type === "card").reduce((s, d) => s + Number(d.amount), 0);
    const totalUsd = todaysDeposits.reduce((s, d) => s + Number(d.amount_usd), 0);
    return { lrd, usd, card, totalUsd };
  }, [todaysDeposits]);

  const canSubmit = globalBranch && globalShift && rows.every(r => r.deposit_type && r.amount && parseFloat(r.amount) > 0);

  return (
    <AppLayout title="Cash Reports" subtitle="Record daily cash deposits and reconcile by shift">
      {/* Controls */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5 text-primary" /> Shift & Exchange Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Branch *</Label>
              <Select value={globalBranch} onValueChange={(v) => { setGlobalBranch(v); setRows([emptyRow(defaultExchangeRate)]); }}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift *</Label>
              <Select value={globalShift} onValueChange={setGlobalShift}>
                <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>
                  {shifts?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exchange Rate (LRD/USD)</Label>
              <Input type="number" min="1" step="0.5" value={defaultExchangeRate} onChange={(e) => {
                setDefaultExchangeRate(e.target.value);
                setRows(prev => prev.map(r => r.deposit_type === "LRD" ? { ...r, exchange_rate: e.target.value } : r));
              }} />
            </div>
            <div className="space-y-2">
              <Label>Total (USD Equiv.)</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-primary/10 border border-primary/30">
                <span className="font-bold text-primary text-lg">${totals.totalUsd.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">LRD Cash</p>
              <p className="text-xl font-bold">L${totals.lrd.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">USD Cash</p>
              <p className="text-xl font-bold">${totals.usd.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Card Sales</p>
              <p className="text-xl font-bold">${totals.card.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deposit Entry */}
      {globalBranch && globalShift && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Deposit Entries</CardTitle>
              <Button onClick={addRow} size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add Row</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Attendant</TableHead>
                  <TableHead className="min-w-[120px]">Type *</TableHead>
                  <TableHead className="min-w-[120px]">Amount *</TableHead>
                  <TableHead className="min-w-[100px]">Rate</TableHead>
                  <TableHead className="min-w-[100px]">USD Equiv.</TableHead>
                  <TableHead className="min-w-[140px]">Notes</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const usdEquiv = calcUsd(row);
                  return (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Select value={row.attendant_id} onValueChange={(v) => updateRow(row.key, "attendant_id", v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>
                            {attendants?.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.deposit_type} onValueChange={(v) => {
                          updateRow(row.key, "deposit_type", v);
                          if (v === "LRD") updateRow(row.key, "exchange_rate", defaultExchangeRate);
                        }}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LRD">LRD Cash</SelectItem>
                            <SelectItem value="USD">USD Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" className="h-9 text-xs" value={row.amount} onChange={(e) => updateRow(row.key, "amount", e.target.value)} placeholder="0.00" />
                      </TableCell>
                      <TableCell>
                        {row.deposit_type === "LRD" ? (
                          <Input type="number" min="1" step="0.5" className="h-9 text-xs" value={row.exchange_rate} onChange={(e) => updateRow(row.key, "exchange_rate", e.target.value)} />
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-sm text-primary">${usdEquiv.toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 text-xs" value={row.notes} onChange={(e) => updateRow(row.key, "notes", e.target.value)} placeholder="Notes" />
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
            <div className="mt-4 flex justify-between">
              <Button onClick={addRow} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Add Row</Button>
              <Button onClick={() => submitMutation.mutate(rows)} disabled={!canSubmit || submitMutation.isPending} size="sm">
                <Save className="h-4 w-4 mr-2" /> {submitMutation.isPending ? "Saving..." : "Submit Deposits"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submitted Deposits */}
      {todaysDeposits && todaysDeposits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Submitted Deposits — {format(new Date(date), "MMM dd, yyyy")}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                if (!todaysDeposits) return;
                downloadCSV(`cash-deposits-${date}.csv`,
                  ["Attendant", "Type", "Amount", "Rate", "USD Equiv.", "Notes"],
                  todaysDeposits.map(d => [(d.attendants as any)?.full_name || "—", d.deposit_type, Number(d.amount), d.deposit_type === "LRD" ? Number(d.exchange_rate) : "—", Number(d.amount_usd).toFixed(2), d.notes || ""])
                );
              }}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">LRD Total</p>
                <p className="font-bold">L${submittedTotals.lrd.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">USD Total</p>
                <p className="font-bold">${submittedTotals.usd.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Card Total</p>
                <p className="font-bold">${submittedTotals.card.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground">Grand Total (USD)</p>
                <p className="font-bold text-primary">${submittedTotals.totalUsd.toFixed(2)}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">USD Equiv.</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaysDeposits.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{(d.attendants as any)?.full_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs",
                        d.deposit_type === "LRD" ? "border-accent text-accent" :
                        d.deposit_type === "USD" ? "border-success text-success" : "border-info text-info"
                      )}>
                        {d.deposit_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {d.deposit_type === "LRD" ? "L$" : "$"}{Number(d.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{d.deposit_type === "LRD" ? Number(d.exchange_rate).toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-primary">${Number(d.amount_usd).toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{d.notes || "—"}</TableCell>
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

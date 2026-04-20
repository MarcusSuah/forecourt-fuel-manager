import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, ArrowUpDown, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ProfitLoss() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [fromMonth, setFromMonth] = useState(`${now.getFullYear()}-01`);
  const [toMonth, setToMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ entry_type: "income", category: "", description: "", amount: "", date: "", branch_id: "" });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["pl-entries", fromMonth, toMonth],
    queryFn: async () => {
      const from = `${fromMonth}-01`;
      const [toY, toM] = toMonth.split("-").map(Number);
      const endMonth = toM === 12 ? 1 : toM + 1;
      const endYear = toM === 12 ? toY + 1 : toY;
      const to = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const { data, error } = await supabase.from("pl_entries").select("*").gte("date", from).lt("date", to).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("pl_entries").insert(data);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Entry added"); queryClient.invalidateQueries({ queryKey: ["pl-entries"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    if (!entries) return { income: 0, expenditure: 0, profit: 0 };
    const income = entries.filter(e => e.entry_type === "income").reduce((s, e) => s + Number(e.amount), 0);
    const expenditure = entries.filter(e => e.entry_type === "expenditure").reduce((s, e) => s + Number(e.amount), 0);
    return { income, expenditure, profit: income - expenditure };
  }, [entries]);

  const monthlyData = useMemo(() => {
    if (!entries) return [];
    const map: Record<string, { income: number; expenditure: number }> = {};
    entries.forEach(e => {
      const m = e.date.slice(0, 7);
      if (!map[m]) map[m] = { income: 0, expenditure: 0 };
      map[m][e.entry_type as "income" | "expenditure"] += Number(e.amount);
    });
    return Object.entries(map).sort().map(([m, v]) => ({ month: m, ...v, profit: v.income - v.expenditure }));
  }, [entries]);

  const categoryData = useMemo(() => {
    if (!entries) return [];
    const map: Record<string, number> = {};
    entries.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [entries]);

  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

  const status = totals.profit > 0 ? "Profit" : totals.profit < 0 ? "Loss" : "Break-even";

  const hasUnsavedChanges = open && Boolean(
    form.category || form.description || form.amount || form.date || form.branch_id
  );
  const { dialogProps: guardDialog } = useUnsavedChangesGuard(
    hasUnsavedChanges,
    "You have an in-progress P&L entry. Leave without saving?"
  );

  return (
    <AppLayout title="Profit & Loss" subtitle="Track income and expenditure across your operations">
      <UnsavedChangesDialog {...guardDialog} />
      <div className="space-y-4">
        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 items-end justify-between">
              <div className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} className="w-40" />
                </div>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Entry</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add P&L Entry</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select value={form.entry_type} onValueChange={v => setForm(f => ({ ...f, entry_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expenditure">Expenditure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {form.entry_type === "income" ? (
                            <>
                              <SelectItem value="Fuel Sales">Fuel Sales</SelectItem>
                              <SelectItem value="Lubricant Sales">Lubricant Sales</SelectItem>
                              <SelectItem value="Service Income">Service Income</SelectItem>
                              <SelectItem value="Other Income">Other Income</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="Fuel Purchase">Fuel Purchase</SelectItem>
                              <SelectItem value="Salaries">Salaries</SelectItem>
                              <SelectItem value="Utilities">Utilities</SelectItem>
                              <SelectItem value="Rent">Rent</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Transport">Transport</SelectItem>
                              <SelectItem value="Insurance">Insurance</SelectItem>
                              <SelectItem value="Taxes">Taxes</SelectItem>
                              <SelectItem value="Other Expense">Other Expense</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Amount (USD)</Label>
                        <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Date</Label>
                        <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Description</Label>
                      <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Branch (optional)</Label>
                      <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                        <SelectContent>{branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={() => {
                      if (!form.category || !form.amount) { toast.error("Category and amount required"); return; }
                      addMutation.mutate({
                        entry_type: form.entry_type,
                        category: form.category,
                        description: form.description || null,
                        amount: parseFloat(form.amount),
                        date: form.date || new Date().toISOString().split("T")[0],
                        branch_id: form.branch_id || null,
                        created_by: user?.id,
                      });
                    }}>Add Entry</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingUp className="h-4 w-4 text-emerald-500" /> Total Income</div>
              <p className="text-2xl font-bold text-emerald-600">${totals.income.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingDown className="h-4 w-4 text-destructive" /> Total Expenditure</div>
              <p className="text-2xl font-bold text-destructive">${totals.expenditure.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><DollarSign className="h-4 w-4" /> Net {status}</div>
              <p className={`text-2xl font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                ${Math.abs(totals.profit).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><ArrowUpDown className="h-4 w-4" /> Status</div>
              <Badge className={`text-lg px-3 py-1 ${totals.profit > 0 ? "bg-emerald-500/10 text-emerald-600" : totals.profit < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                {status}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" name="Income" />
                  <Bar dataKey="expenditure" fill="hsl(var(--destructive))" name="Expenditure" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">By Category</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Entries Table */}
        <Card>
          <CardHeader><CardTitle className="text-base">All Entries ({entries?.length || 0})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries?.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{format(new Date(e.date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>
                        <Badge className={e.entry_type === "income" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                          {e.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{e.description || "—"}</TableCell>
                      <TableCell className={`text-right font-mono ${e.entry_type === "income" ? "text-emerald-600" : "text-destructive"}`}>
                        {e.entry_type === "income" ? "+" : "-"}${Number(e.amount).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )) || <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No entries</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

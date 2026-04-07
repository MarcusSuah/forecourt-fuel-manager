import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Landmark, CreditCard, Scale, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { downloadCSV } from "@/lib/csv-export";
import { exportTableToPDF } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function FinancialSituation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [fromMonth, setFromMonth] = useState(`${now.getFullYear()}-01`);
  const [toMonth, setToMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [assetOpen, setAssetOpen] = useState(false);
  const [liabOpen, setLiabOpen] = useState(false);

  const dateRange = useMemo(() => {
    const from = `${fromMonth}-01`;
    const [toY, toM] = toMonth.split("-").map(Number);
    const endMonth = toM === 12 ? 1 : toM + 1;
    const endYear = toM === 12 ? toY + 1 : toY;
    return { from, to: `${endYear}-${String(endMonth).padStart(2, "0")}-01` };
  }, [fromMonth, toMonth]);

  const { data: assets } = useQuery({
    queryKey: ["financial-assets", fromMonth, toMonth],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_assets").select("*").gte("date", dateRange.from).lt("date", dateRange.to).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: liabilities } = useQuery({
    queryKey: ["financial-liabilities", fromMonth, toMonth],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_liabilities").select("*").gte("date", dateRange.from).lt("date", dateRange.to).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalAssets = assets?.reduce((s, a) => s + Number(a.value), 0) || 0;
  const totalLiabilities = liabilities?.reduce((s, l) => s + Number(l.value), 0) || 0;
  const netWorth = totalAssets - totalLiabilities;

  const [assetForm, setAssetForm] = useState({ name: "", category: "", value: "", date: "", notes: "" });
  const [liabForm, setLiabForm] = useState({ name: "", category: "", value: "", date: "", notes: "" });

  const addAsset = useMutation({
    mutationFn: async (data: any) => { const { error } = await supabase.from("financial_assets").insert(data); if (error) throw error; },
    onSuccess: () => { toast.success("Asset added"); queryClient.invalidateQueries({ queryKey: ["financial-assets"] }); setAssetOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLiab = useMutation({
    mutationFn: async (data: any) => { const { error } = await supabase.from("financial_liabilities").insert(data); if (error) throw error; },
    onSuccess: () => { toast.success("Liability added"); queryClient.invalidateQueries({ queryKey: ["financial-liabilities"] }); setLiabOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const chartData = [
    { name: "Assets", value: totalAssets },
    { name: "Liabilities", value: totalLiabilities },
    { name: "Net Worth", value: Math.max(netWorth, 0) },
  ];

  const ASSET_CATEGORIES = ["Cash & Bank", "Fuel Inventory", "Equipment", "Vehicles", "Property", "Receivables", "Other Assets"];
  const LIAB_CATEGORIES = ["Bank Loans", "Supplier Payables", "Tax Liabilities", "Salaries Payable", "Rent Payable", "Other Liabilities"];

  const renderForm = (type: "asset" | "liability") => {
    const f = type === "asset" ? assetForm : liabForm;
    const setF = type === "asset" ? setAssetForm : setLiabForm;
    const cats = type === "asset" ? ASSET_CATEGORIES : LIAB_CATEGORIES;
    const submit = () => {
      if (!f.name || !f.category || !f.value) { toast.error("Name, category and value required"); return; }
      const data = { name: f.name, category: f.category, value: parseFloat(f.value), date: f.date || new Date().toISOString().split("T")[0], notes: f.notes || null, created_by: user?.id };
      type === "asset" ? addAsset.mutate(data) : addLiab.mutate(data);
    };
    return (
      <div className="space-y-3">
        <div className="space-y-1"><Label>Name</Label><Input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={f.category} onValueChange={v => setF(p => ({ ...p, category: v }))}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Value (USD)</Label><Input type="number" value={f.value} onChange={e => setF(p => ({ ...p, value: e.target.value }))} /></div>
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} /></div>
        </div>
        <div className="space-y-1"><Label>Notes</Label><Textarea value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} /></div>
        <Button className="w-full" onClick={submit}>Add {type === "asset" ? "Asset" : "Liability"}</Button>
      </div>
    );
  };

  return (
    <AppLayout title="Financial Situation" subtitle="Assets, liabilities, and net worth overview">
      <div className="space-y-4">
        {/* Date Range */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1"><Label>From</Label><Input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="w-40" /></div>
              <div className="space-y-1"><Label>To</Label><Input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} className="w-40" /></div>
              <Button variant="outline" size="sm" onClick={() => {
                const allRows = [...(assets || []).map(a => ["Asset", a.name, a.category, String(a.value), a.date]), ...(liabilities || []).map(l => ["Liability", l.name, l.category, String(l.value), l.date])];
                if (!allRows.length) return toast.error("No data");
                downloadCSV(`financial-situation-${fromMonth}-to-${toMonth}.csv`, ["Type","Name","Category","Value (USD)","Date"], allRows);
              }}><Download className="h-4 w-4 mr-1" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const allRows = [...(assets || []).map(a => ["Asset", a.name, a.category, `$${Number(a.value).toLocaleString()}`, a.date]), ...(liabilities || []).map(l => ["Liability", l.name, l.category, `$${Number(l.value).toLocaleString()}`, l.date])];
                if (!allRows.length) return toast.error("No data");
                exportTableToPDF("Financial Situation", `${fromMonth} to ${toMonth}`, ["Type","Name","Category","Value","Date"], allRows,
                  [{ label: "Total Assets", value: `$${totalAssets.toLocaleString()}` }, { label: "Total Liabilities", value: `$${totalLiabilities.toLocaleString()}` }, { label: "Net Worth", value: `$${netWorth.toLocaleString()}` }]);
              }}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Landmark className="h-4 w-4 text-emerald-500" /> Total Assets</div>
              <p className="text-2xl font-bold text-emerald-600">${totalAssets.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><CreditCard className="h-4 w-4 text-destructive" /> Total Liabilities</div>
              <p className="text-2xl font-bold text-destructive">${totalLiabilities.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Scale className="h-4 w-4" /> Net Worth</div>
              <p className={`text-2xl font-bold ${netWorth >= 0 ? "text-emerald-600" : "text-destructive"}`}>${netWorth.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Financial Overview</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Assets & Liabilities Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Assets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-5 w-5 text-emerald-500" /> Assets</CardTitle>
              <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>{renderForm("asset")}</DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {assets?.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell><Badge variant="outline">{a.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">${Number(a.value).toLocaleString()}</TableCell>
                      <TableCell>{format(new Date(a.date), "MMM dd")}</TableCell>
                    </TableRow>
                  )) || <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No assets</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Liabilities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-5 w-5 text-destructive" /> Liabilities</CardTitle>
              <Dialog open={liabOpen} onOpenChange={setLiabOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Add Liability</DialogTitle></DialogHeader>{renderForm("liability")}</DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {liabilities?.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell><Badge variant="outline">{l.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-destructive">${Number(l.value).toLocaleString()}</TableCell>
                      <TableCell>{format(new Date(l.date), "MMM dd")}</TableCell>
                    </TableRow>
                  )) || <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No liabilities</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

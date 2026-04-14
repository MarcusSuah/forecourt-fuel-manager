import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchFilter, useBranchSelect } from "@/hooks/useDealerBranch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Truck, Package, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Deliveries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { branchFilter, setBranchFilter, isBranchDisabled } = useBranchFilter();
  const { selectedBranch: formBranch, setSelectedBranch: setFormBranch, isBranchDisabled: formBranchDisabled } = useBranchSelect();

  // Form state - formBranch handled by useBranchSelect
  const [formTank, setFormTank] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formDriver, setFormDriver] = useState("");
  const [formPlate, setFormPlate] = useState("");
  const [formReceipt, setFormReceipt] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tanks } = useQuery({
    queryKey: ["tanks-for-delivery", formBranch],
    queryFn: async () => {
      let q = supabase.from("tanks").select("id, name, product_type, capacity_usg, current_level_usg, branch_id").eq("is_active", true);
      if (formBranch) q = q.eq("branch_id", formBranch);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["fuel-deliveries", branchFilter],
    queryFn: async () => {
      let q = supabase
        .from("fuel_deliveries")
        .select("*, branches(name), tanks(name, product_type)")
        .order("delivery_date", { ascending: false })
        .limit(100);
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(formQuantity);
      if (!formBranch || !formTank || isNaN(qty) || qty <= 0) {
        throw new Error("Please fill branch, tank, and a valid quantity");
      }
      const { error } = await supabase.from("fuel_deliveries").insert({
        branch_id: formBranch,
        tank_id: formTank,
        delivery_date: formDate,
        quantity_usg: qty,
        supplier: formSupplier || null,
        driver_name: formDriver || null,
        vehicle_plate: formPlate || null,
        receipt_number: formReceipt || null,
        notes: formNotes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery recorded & tank level updated!");
      queryClient.invalidateQueries({ queryKey: ["fuel-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tanks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tanks-summary"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setFormBranch(""); setFormTank(""); setFormQuantity("");
    setFormSupplier(""); setFormDriver(""); setFormPlate("");
    setFormReceipt(""); setFormNotes("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
  };

  const selectedTank = tanks?.find(t => t.id === formTank);
  const totalDelivered = deliveries?.reduce((s, d) => s + Number(d.quantity_usg), 0) ?? 0;
  const todayCount = deliveries?.filter(d => d.delivery_date === format(new Date(), "yyyy-MM-dd")).length ?? 0;

  return (
    <AppLayout title="Fuel Deliveries" subtitle="Track incoming stock deliveries and receipts">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-52 bg-card"><SelectValue placeholder="All Branches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Record Delivery</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" /> Record Fuel Delivery
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch *</Label>
                  <Select value={formBranch} onValueChange={(v) => { setFormBranch(v); setFormTank(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Delivery Date *</Label>
                  <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tank *</Label>
                  <Select value={formTank} onValueChange={setFormTank} disabled={!formBranch}>
                    <SelectTrigger><SelectValue placeholder="Select tank" /></SelectTrigger>
                    <SelectContent>
                      {tanks?.filter(t => t.branch_id === formBranch).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.product_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTank && (
                    <p className="text-xs text-muted-foreground">
                      Current: {Number(selectedTank.current_level_usg).toLocaleString()} / {Number(selectedTank.capacity_usg).toLocaleString()} USG
                      ({((Number(selectedTank.current_level_usg) / Number(selectedTank.capacity_usg)) * 100).toFixed(0)}%)
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Quantity (USG) *</Label>
                  <Input type="number" value={formQuantity} onChange={e => setFormQuantity(e.target.value)} placeholder="e.g. 5000" />
                  {selectedTank && formQuantity && (
                    <p className="text-xs text-muted-foreground">
                      After: {Math.min(Number(selectedTank.current_level_usg) + parseFloat(formQuantity || "0"), Number(selectedTank.capacity_usg)).toLocaleString()} USG
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input value={formSupplier} onChange={e => setFormSupplier(e.target.value)} placeholder="e.g. LPRC" />
                </div>
                <div className="space-y-2">
                  <Label>Receipt Number</Label>
                  <Input value={formReceipt} onChange={e => setFormReceipt(e.target.value)} placeholder="e.g. DEL-2026-001" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Driver Name</Label>
                  <Input value={formDriver} onChange={e => setFormDriver(e.target.value)} placeholder="Driver name" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Plate</Label>
                  <Input value={formPlate} onChange={e => setFormPlate(e.target.value)} placeholder="e.g. ABC-1234" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
              </div>

              <Button onClick={() => createMutation.mutate()} className="w-full" disabled={createMutation.isPending}>
                <Truck className="h-4 w-4 mr-2" /> Record Delivery
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Total Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{totalDelivered.toLocaleString()} USG</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" /> Total Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{deliveries?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{todayCount} deliveries</p>
          </CardContent>
        </Card>
      </div>

      {/* Delivery History Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Delivery History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Tank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity (USG)</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Driver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No deliveries recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveries?.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{format(new Date(d.delivery_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{(d.branches as any)?.name}</TableCell>
                      <TableCell>{(d.tanks as any)?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {(d.tanks as any)?.product_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{Number(d.quantity_usg).toLocaleString()}</TableCell>
                      <TableCell>{d.supplier || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{d.receipt_number || "—"}</TableCell>
                      <TableCell>{d.driver_name || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

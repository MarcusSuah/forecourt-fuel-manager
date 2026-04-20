import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Fuel, Plus, Edit2, Power, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductType = "PMS" | "AGO";

export default function Pumps() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isDealer, dealerBranchId } = useDealerBranch();
  const role = user?.role;
  const canManage = role === "admin" || role === "supervisor" || role === "dealer";

  const [filterBranch, setFilterBranch] = useState<string>(isDealer ? dealerBranchId ?? "" : "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Form state
  const [fName, setFName] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fIsland, setFIsland] = useState<string>("none");
  const [fProduct, setFProduct] = useState<ProductType>("PMS");
  const [fTotalizers, setFTotalizers] = useState<number>(1);
  const [fActive, setFActive] = useState(true);

  const { data: branches } = useQuery({
    queryKey: ["branches-for-pumps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: islands } = useQuery({
    queryKey: ["islands-for-pumps", fBranch],
    enabled: !!fBranch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("islands")
        .select("id, island_number")
        .eq("branch_id", fBranch)
        .eq("is_active", true)
        .order("island_number");
      if (error) throw error;
      return data;
    },
  });

  const effectiveBranch = isDealer ? dealerBranchId ?? "" : filterBranch;

  const { data: pumps, isLoading } = useQuery({
    queryKey: ["pumps-mgmt", effectiveBranch],
    queryFn: async () => {
      let q = supabase
        .from("pumps")
        .select("*, branches(name), islands(island_number)")
        .order("name");
      if (effectiveBranch && effectiveBranch !== "all") q = q.eq("branch_id", effectiveBranch);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const openDialog = (pump?: any) => {
    if (pump) {
      setEditing(pump);
      setFName(pump.name);
      setFBranch(pump.branch_id);
      setFIsland(pump.island_id ?? "none");
      setFProduct(pump.product_type);
      setFTotalizers(pump.totalizers_count ?? 1);
      setFActive(pump.is_active);
    } else {
      setEditing(null);
      setFName("");
      setFBranch(isDealer ? dealerBranchId ?? "" : "");
      setFIsland("none");
      setFProduct("PMS");
      setFTotalizers(1);
      setFActive(true);
    }
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!fName.trim()) throw new Error("Pump name is required");
      if (!fBranch) throw new Error("Select a branch");
      const payload = {
        name: fName.trim(),
        branch_id: fBranch,
        island_id: fIsland === "none" ? null : fIsland,
        product_type: fProduct,
        totalizers_count: Number(fTotalizers) || 1,
        is_active: fActive,
      };
      if (editing?.id) {
        const { error } = await supabase.from("pumps").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pumps").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Pump updated" : "Pump added");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["pumps-mgmt"] });
      qc.invalidateQueries({ queryKey: ["pumps-meter"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (pump: any) => {
      const { error } = await supabase
        .from("pumps")
        .update({ is_active: !pump.is_active })
        .eq("id", pump.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pump status updated");
      qc.invalidateQueries({ queryKey: ["pumps-mgmt"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = useMemo(() => {
    const list = pumps ?? [];
    return {
      total: list.length,
      active: list.filter((p: any) => p.is_active).length,
      pms: list.filter((p: any) => p.product_type === "PMS").length,
      ago: list.filter((p: any) => p.product_type === "AGO").length,
    };
  }, [pumps]);

  return (
    <AppLayout title="Pump Management" subtitle="Add, edit and deactivate forecourt pumps per station">
      {!canManage && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <Lock className="h-4 w-4 text-warning" />
          <span className="text-muted-foreground">Read-only — only Admin, Supervisor, or Dealer can manage pumps.</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Pumps</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-bold text-success">{summary.active}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">PMS Pumps</p><p className="text-2xl font-bold text-fuel-pms">{summary.pms}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">AGO Pumps</p><p className="text-2xl font-bold text-fuel-ago">{summary.ago}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="h-5 w-5 text-primary" /> Pumps
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isDealer && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {canManage && (
                <Button size="sm" onClick={() => openDialog()}>
                  <Plus className="h-4 w-4 mr-1" /> Add Pump
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pump</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Island</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Totalizers</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : (pumps ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No pumps found. {canManage && "Click 'Add Pump' to create one."}</TableCell></TableRow>
              ) : (
                pumps?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.branches?.name ?? "—"}</TableCell>
                    <TableCell>{p.islands?.island_number ? `Island ${p.islands.island_number}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", p.product_type === "PMS" ? "border-fuel-pms text-fuel-pms bg-fuel-pms/10" : "border-fuel-ago text-fuel-ago bg-fuel-ago/10")}>
                        {p.product_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{p.totalizers_count}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-success/15 text-success border-success/30" : ""}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openDialog(p)} title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toggleActive.mutate(p)} title={p.is_active ? "Deactivate" : "Activate"}>
                            <Power className={cn("h-4 w-4", p.is_active ? "text-success" : "text-muted-foreground")} />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pump" : "Add Pump"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Pump Name</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Pump 1" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={fBranch} onValueChange={(v) => { setFBranch(v); setFIsland("none"); }} disabled={isDealer}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Island</Label>
                <Select value={fIsland} onValueChange={setFIsland}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {islands?.map((i) => <SelectItem key={i.id} value={i.id}>Island {i.island_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select value={fProduct} onValueChange={(v: ProductType) => setFProduct(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PMS">PMS</SelectItem>
                    <SelectItem value="AGO">AGO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Totalizers</Label>
                <Input type="number" min={1} value={fTotalizers} onChange={(e) => setFTotalizers(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={fActive} onCheckedChange={setFActive} />
                  <span className="text-sm text-muted-foreground">{fActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Tank assignment is managed on the Tank Management page.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Add Pump"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

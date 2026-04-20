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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Fuel, Plus, Edit2, Power, Lock, Copy } from "lucide-react";
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
  const [fTankIds, setFTankIds] = useState<string[]>([]);

  // Copy dialog state
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState<string>("");
  const [copyTarget, setCopyTarget] = useState<string>("");

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

  // Tanks available for assignment in the pump form (same branch + product)
  const { data: formTanks } = useQuery({
    queryKey: ["tanks-for-pump-form", fBranch, fProduct],
    enabled: !!fBranch && !!fProduct,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks")
        .select("id, name, product_type, capacity_usg")
        .eq("branch_id", fBranch)
        .eq("product_type", fProduct)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Existing tank assignments for the pump being edited
  const { data: existingAssignments } = useQuery({
    queryKey: ["tank-pump-assignments-edit", editing?.id],
    enabled: !!editing?.id && dialogOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tank_pump_assignments")
        .select("tank_id")
        .eq("pump_id", editing.id);
      if (error) throw error;
      return data;
    },
  });

  // Sync selected tank ids when edit dialog loads existing assignments
  useMemo(() => {
    if (dialogOpen && editing?.id && existingAssignments) {
      setFTankIds(existingAssignments.map((a: any) => a.tank_id));
    }
  }, [existingAssignments, dialogOpen, editing?.id]);

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
      setFTankIds([]); // will populate from existingAssignments query
    } else {
      setEditing(null);
      setFName("");
      setFBranch(isDealer ? dealerBranchId ?? "" : "");
      setFIsland("none");
      setFProduct("PMS");
      setFTotalizers(1);
      setFActive(true);
      setFTankIds([]);
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
      let pumpId: string;
      if (editing?.id) {
        const { error } = await supabase.from("pumps").update(payload).eq("id", editing.id);
        if (error) throw error;
        pumpId = editing.id;
      } else {
        const { data, error } = await supabase.from("pumps").insert(payload).select("id").single();
        if (error) throw error;
        pumpId = data.id;
      }

      // Sync tank assignments: remove old (for this pump), insert current selection
      const { error: delErr } = await supabase
        .from("tank_pump_assignments")
        .delete()
        .eq("pump_id", pumpId);
      if (delErr) throw delErr;
      if (fTankIds.length > 0) {
        const rows = fTankIds.map((tank_id) => ({ pump_id: pumpId, tank_id }));
        const { error: insErr } = await supabase.from("tank_pump_assignments").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Pump updated" : "Pump added");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["pumps-mgmt"] });
      qc.invalidateQueries({ queryKey: ["pumps-meter"] });
      qc.invalidateQueries({ queryKey: ["tank-pump-assignments-report"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Copy pumps from one branch to another (recreates pump rows + tank assignments where matching tank names exist)
  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!copySource) throw new Error("Select a source branch");
      if (!copyTarget) throw new Error("Select a target branch");
      if (copySource === copyTarget) throw new Error("Source and target must differ");

      const { data: srcPumps, error: e1 } = await supabase
        .from("pumps")
        .select("id, name, product_type, totalizers_count, is_active")
        .eq("branch_id", copySource)
        .eq("is_active", true);
      if (e1) throw e1;
      if (!srcPumps || srcPumps.length === 0) throw new Error("Source branch has no active pumps");

      // Skip names already present in target branch
      const { data: existing, error: e2 } = await supabase
        .from("pumps")
        .select("name")
        .eq("branch_id", copyTarget);
      if (e2) throw e2;
      const existingNames = new Set((existing ?? []).map((p: any) => p.name.toLowerCase()));
      const toCreate = srcPumps.filter((p: any) => !existingNames.has(p.name.toLowerCase()));
      if (toCreate.length === 0) throw new Error("All pump names already exist in target branch");

      const insertRows = toCreate.map((p: any) => ({
        name: p.name,
        branch_id: copyTarget,
        product_type: p.product_type,
        totalizers_count: p.totalizers_count,
        is_active: true,
      }));
      const { error: e3 } = await supabase.from("pumps").insert(insertRows);
      if (e3) throw e3;
      return toCreate.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} pump${count === 1 ? "" : "s"} copied`);
      setCopyOpen(false);
      setCopySource("");
      setCopyTarget("");
      qc.invalidateQueries({ queryKey: ["pumps-mgmt"] });
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
                <>
                  {!isDealer && (
                    <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}>
                      <Copy className="h-4 w-4 mr-1" /> Copy Pumps
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openDialog()}>
                    <Plus className="h-4 w-4 mr-1" /> Add Pump
                  </Button>
                </>
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
            <div className="space-y-2">
              <Label>Assigned Tanks <span className="text-xs text-muted-foreground font-normal">({fProduct} only, same branch)</span></Label>
              {!fBranch ? (
                <p className="text-xs text-muted-foreground">Select a branch first.</p>
              ) : (formTanks ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No active {fProduct} tanks in this branch.</p>
              ) : (
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                  {formTanks?.map((t: any) => {
                    const checked = fTankIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setFTankIds((prev) => (v ? [...prev, t.id] : prev.filter((x) => x !== t.id)))
                          }
                        />
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">· {Number(t.capacity_usg).toLocaleString()} USG</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">One pump can be linked to multiple tanks of the same product.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Add Pump"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Pumps to Another Branch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Source Branch</Label>
              <Select value={copySource} onValueChange={setCopySource}>
                <SelectTrigger><SelectValue placeholder="Copy pumps from…" /></SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Branch</Label>
              <Select value={copyTarget} onValueChange={setCopyTarget}>
                <SelectTrigger><SelectValue placeholder="Copy pumps to…" /></SelectTrigger>
                <SelectContent>
                  {branches?.filter((b) => b.id !== copySource).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Duplicates active pumps (name, product, totalizers) from source to target. Pumps with names that already exist in the target branch are skipped. Tank assignments are not copied.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>Cancel</Button>
            <Button onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending || !copySource || !copyTarget}>
              {copyMutation.isPending ? "Copying…" : "Copy Pumps"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { AppLayout } from "@/components/layout/AppLayout";
import { TankCard } from "@/components/dashboard/TankCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Constants } from "@/integrations/supabase/types";

export default function Tanks() {
  const { user } = useAuth();
  const { isDealer, dealerBranchId } = useDealerBranch();
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<any>(null);

  // Form state for create
  const [tankName, setTankName] = useState("");
  const [tankBranch, setTankBranch] = useState("");
  const [tankProduct, setTankProduct] = useState<string>("");
  const [tankCapacity, setTankCapacity] = useState("");
  const [tankThreshold, setTankThreshold] = useState("");

  // Form state for edit
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editCurrentLevel, setEditCurrentLevel] = useState("");
  const [editThreshold, setEditThreshold] = useState("");

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tanks, isLoading } = useQuery({
    queryKey: ["tanks"],
    queryFn: async () => {
      let query = supabase.from("tanks").select("*, branches(name)").eq("is_active", true).order("name");
      if (isDealer && dealerBranchId) {
        query = query.eq("branch_id", dealerBranchId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createTankMutation = useMutation({
    mutationFn: async () => {
      const capacity = parseFloat(tankCapacity);
      const threshold = parseFloat(tankThreshold) || 0;
      const branch = isDealer ? dealerBranchId : tankBranch;
      if (!tankName.trim() || !branch || !tankProduct || isNaN(capacity) || capacity <= 0) {
        throw new Error("Please fill all required fields with valid values");
      }
      const { error } = await supabase.from("tanks").insert({
        name: tankName.trim(),
        branch_id: branch,
        product_type: tankProduct as "PMS" | "AGO",
        capacity_usg: capacity,
        threshold_usg: threshold,
        current_level_usg: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tank created successfully");
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      setDialogOpen(false);
      setTankName(""); setTankBranch(""); setTankProduct(""); setTankCapacity(""); setTankThreshold("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateTankMutation = useMutation({
    mutationFn: async () => {
      if (!editingTank) throw new Error("No tank selected");
      const capacity = parseFloat(editCapacity);
      const currentLevel = parseFloat(editCurrentLevel);
      const threshold = parseFloat(editThreshold) || 0;
      if (!editName.trim() || isNaN(capacity) || capacity <= 0 || isNaN(currentLevel) || currentLevel < 0) {
        throw new Error("Please fill all required fields with valid values");
      }
      if (currentLevel > capacity) {
        throw new Error(`Current level (${currentLevel}) cannot exceed tank capacity (${capacity})`);
      }
      const { error } = await supabase.from("tanks").update({
        name: editName.trim(),
        capacity_usg: capacity,
        current_level_usg: currentLevel,
        threshold_usg: threshold,
      }).eq("id", editingTank.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tank updated successfully");
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      setEditDialogOpen(false);
      setEditingTank(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateTankMutation = useMutation({
    mutationFn: async (tankId: string) => {
      const { error } = await supabase.from("tanks").update({ is_active: false }).eq("id", tankId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tank deactivated");
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleEdit = (tank: any) => {
    setEditingTank(tank);
    setEditName(tank.name);
    setEditCapacity(String(tank.capacity_usg));
    setEditCurrentLevel(String(tank.current_level_usg));
    setEditThreshold(String(tank.threshold_usg));
    setEditDialogOpen(true);
  };

  const filteredTanks = (tanks ?? []).filter((t) => {
    if (branchFilter !== "all" && t.branch_id !== branchFilter) return false;
    if (productFilter !== "all" && t.product_type !== productFilter.toUpperCase()) return false;
    if (statusFilter !== "all") {
      const pct = Number(t.current_level_usg) / Number(t.capacity_usg);
      if (statusFilter === "full" && pct < 0.7) return false;
      if (statusFilter === "medium" && (pct < 0.3 || pct >= 0.7)) return false;
      if (statusFilter === "low" && pct >= 0.3) return false;
    }
    return true;
  });

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <AppLayout title="Tank Management" subtitle="Monitor and manage fuel tank levels">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {!isDealer && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-52 bg-card"><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-32 bg-card"><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="pms">PMS Only</SelectItem>
              <SelectItem value="ago">AGO Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="full">Full (70%+)</SelectItem>
              <SelectItem value="medium">Medium (30-70%)</SelectItem>
              <SelectItem value="low">Low (&lt;30%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" /> Add Tank
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Tank</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tank Name *</Label>
                <Input value={tankName} onChange={(e) => setTankName(e.target.value)} placeholder="e.g. Tank 1" />
              </div>
              {!isDealer && (
                <div className="space-y-2">
                  <Label>Branch *</Label>
                  <Select value={tankBranch} onValueChange={setTankBranch}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Product Type *</Label>
                <Select value={tankProduct} onValueChange={setTankProduct}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.product_type.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capacity (USG) *</Label>
                  <Input type="number" value={tankCapacity} onChange={(e) => setTankCapacity(e.target.value)} placeholder="e.g. 10000" />
                </div>
                <div className="space-y-2">
                  <Label>Threshold (USG)</Label>
                  <Input type="number" value={tankThreshold} onChange={(e) => setTankThreshold(e.target.value)} placeholder="e.g. 1000" />
                </div>
              </div>
              <Button onClick={() => createTankMutation.mutate()} className="w-full" disabled={createTankMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" /> Create Tank
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tank</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Tank Name *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity (USG) *</Label>
                <Input type="number" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Current Level (USG) *</Label>
                <Input type="number" value={editCurrentLevel} onChange={(e) => setEditCurrentLevel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Threshold (USG)</Label>
              <Input type="number" value={editThreshold} onChange={(e) => setEditThreshold(e.target.value)} />
            </div>
            <Button onClick={() => updateTankMutation.mutate()} className="w-full" disabled={updateTankMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <p className="text-sm text-muted-foreground">Total Tanks</p>
          <p className="text-2xl font-bold text-foreground mt-1">{filteredTanks.length}</p>
        </div>
        <div className="metric-card border-success/30">
          <p className="text-sm text-muted-foreground">Optimal (70%+)</p>
          <p className="text-2xl font-bold text-success mt-1">
            {filteredTanks.filter((t) => Number(t.current_level_usg) / Number(t.capacity_usg) >= 0.7).length}
          </p>
        </div>
        <div className="metric-card border-warning/30">
          <p className="text-sm text-muted-foreground">Moderate (30-70%)</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {filteredTanks.filter((t) => {
              const pct = Number(t.current_level_usg) / Number(t.capacity_usg);
              return pct >= 0.3 && pct < 0.7;
            }).length}
          </p>
        </div>
        <div className="metric-card border-destructive/30">
          <p className="text-sm text-muted-foreground">Low Stock (&lt;30%)</p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {filteredTanks.filter((t) => Number(t.current_level_usg) / Number(t.capacity_usg) < 0.3).length}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTanks.map((tank) => (
            <div key={tank.id} className="relative group">
              <TankCard
                name={tank.name}
                product={tank.product_type}
                capacity={Number(tank.capacity_usg)}
                currentLevel={Number(tank.current_level_usg)}
                branch={(tank.branches as any)?.name ?? "Unknown"}
                lastUpdated={getTimeSince(tank.updated_at)}
                onEdit={() => handleEdit(tank)}
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  if (confirm(`Deactivate tank "${tank.name}"?`)) {
                    deactivateTankMutation.mutate(tank.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

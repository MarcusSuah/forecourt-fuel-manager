import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { TankCard } from "@/components/dashboard/TankCard";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function Tanks() {
  const [branchFilter, setBranchFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
      const { data, error } = await supabase
        .from("tanks")
        .select("*, branches(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

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
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  return (
    <AppLayout title="Tank Management" subtitle="Monitor and manage fuel tank levels">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-52 bg-card">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-32 bg-card">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="pms">PMS Only</SelectItem>
              <SelectItem value="ago">AGO Only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="full">Full (70%+)</SelectItem>
              <SelectItem value="medium">Medium (30-70%)</SelectItem>
              <SelectItem value="low">Low (&lt;30%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Tank
          </Button>
        </div>
      </div>

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

      {/* Tank Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTanks.map((tank) => (
            <TankCard
              key={tank.id}
              name={tank.name}
              product={tank.product_type}
              capacity={Number(tank.capacity_usg)}
              currentLevel={Number(tank.current_level_usg)}
              branch={(tank.branches as any)?.name ?? "Unknown"}
              lastUpdated={getTimeSince(tank.updated_at)}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

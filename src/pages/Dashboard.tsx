import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TankCard } from "@/components/dashboard/TankCard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { CashSummary } from "@/components/dashboard/CashSummary";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { BranchPerformance } from "@/components/dashboard/BranchPerformance";
import { Fuel, DollarSign, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: tanks, isLoading: tanksLoading } = useQuery({
    queryKey: ["dashboard-tanks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks")
        .select("*, branches(name)")
        .eq("is_active", true)
        .order("current_level_usg", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  const { data: allTanks } = useQuery({
    queryKey: ["all-tanks-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks")
        .select("product_type, current_level_usg")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: attendantCount } = useQuery({
    queryKey: ["attendant-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendants")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: branchCount } = useQuery({
    queryKey: ["branch-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("branches")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pmsTotal = allTanks?.filter(t => t.product_type === "PMS").reduce((sum, t) => sum + Number(t.current_level_usg), 0) ?? 0;
  const agoTotal = allTanks?.filter(t => t.product_type === "AGO").reduce((sum, t) => sum + Number(t.current_level_usg), 0) ?? 0;

  const alerts = [];
  if (allTanks) {
    // Generate alerts from real tank data
    for (const t of (tanks ?? [])) {
      const pct = Number(t.current_level_usg) / Number(t.capacity_usg);
      if (pct < 0.2) {
        alerts.push({
          id: t.id,
          type: "error" as const,
          title: "Critical Stock Alert",
          message: `${t.name} at ${(t.branches as any)?.name} is at ${Math.round(pct * 100)}% capacity. Schedule delivery immediately.`,
          timestamp: "Now",
          branch: (t.branches as any)?.name,
        });
      } else if (pct < 0.3) {
        alerts.push({
          id: t.id,
          type: "warning" as const,
          title: "Low Stock Warning",
          message: `${t.name} at ${(t.branches as any)?.name} is below 30% capacity.`,
          timestamp: "Now",
          branch: (t.branches as any)?.name,
        });
      }
    }
  }

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <AppLayout title="Dashboard" subtitle="Real-time overview of all stations">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Sales Today"
          value="$32,950"
          icon={<DollarSign className="h-6 w-6" />}
          trend={{ value: 12.5, label: "vs yesterday" }}
          variant="primary"
        />
        <MetricCard
          title="Total PMS Stock"
          value={`${pmsTotal.toLocaleString()} USG`}
          icon={<Fuel className="h-6 w-6" />}
          subtitle="Across all stations"
          variant="success"
        />
        <MetricCard
          title="Total AGO Stock"
          value={`${agoTotal.toLocaleString()} USG`}
          icon={<Fuel className="h-6 w-6" />}
          subtitle="Across all stations"
          variant="warning"
        />
        <MetricCard
          title="Active Attendants"
          value={String(attendantCount ?? 0)}
          icon={<Users className="h-6 w-6" />}
          subtitle={`Across ${branchCount ?? 0} stations`}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <div>
          <CashSummary cashLRD={1250000} cashUSD={8540} cardSalesUSD={3250} exchangeRate={192} />
        </div>
      </div>

      {/* Tank Status and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Tank Status</h2>
            <a href="/tanks" className="text-sm text-primary hover:underline">View all tanks</a>
          </div>
          {tanksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(tanks ?? []).map((tank) => (
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
        </div>

        <div>
          <AlertCard alerts={alerts.length > 0 ? alerts : [
            { id: "ok", type: "success" as const, title: "All Clear", message: "All tanks are at healthy levels.", timestamp: "Now" }
          ]} />
        </div>
      </div>

      <BranchPerformance />
    </AppLayout>
  );
}

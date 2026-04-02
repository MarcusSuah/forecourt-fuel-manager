import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TankCard } from "@/components/dashboard/TankCard";
import { CashSummary } from "@/components/dashboard/CashSummary";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { BranchPerformance } from "@/components/dashboard/BranchPerformance";
import { Fuel, DollarSign, Users, AlertTriangle, Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Dashboard() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: tanks, isLoading: tanksLoading } = useQuery({
    queryKey: ["dashboard-tanks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks")
        .select("*, branches(name)")
        .eq("is_active", true)
        .order("current_level_usg", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const { data: allTanks } = useQuery({
    queryKey: ["all-tanks-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks")
        .select("id, name, product_type, current_level_usg, capacity_usg, status, branch_id, branches(name)")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: thresholds } = useQuery({
    queryKey: ["tank-thresholds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "tank_thresholds")
        .single();
      if (error) return { critical_pct: 20, low_pct: 30, medium_pct: 60 };
      return data.value as { critical_pct: number; low_pct: number; medium_pct: number };
    },
  });

  const { data: todaySales } = useQuery({
    queryKey: ["dashboard-today-sales", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_sales_reports")
        .select("total_sales_usd, sales_usg, pumps(product_type)")
        .eq("date", today);
      if (error) throw error;
      return data;
    },
  });

  const { data: todayCash } = useQuery({
    queryKey: ["dashboard-today-cash", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_deposits")
        .select("amount, amount_usd, deposit_type")
        .eq("date", today);
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

  // Realtime tank updates
  useEffect(() => {
    const channel = supabase
      .channel("tank-alerts")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tanks" }, (payload) => {
        const tank = payload.new as any;
        const pct = (Number(tank.current_level_usg) / Number(tank.capacity_usg)) * 100;
        const critPct = thresholds?.critical_pct ?? 20;
        if (pct < critPct) {
          toast.error(`🚨 Critical: ${tank.name} is at ${pct.toFixed(0)}% capacity!`, {
            duration: 10000,
            description: "Schedule delivery immediately.",
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [thresholds]);

  // Calculate totals
  const pmsTotal = allTanks?.filter(t => t.product_type === "PMS").reduce((sum, t) => sum + Number(t.current_level_usg), 0) ?? 0;
  const agoTotal = allTanks?.filter(t => t.product_type === "AGO").reduce((sum, t) => sum + Number(t.current_level_usg), 0) ?? 0;
  const todaySalesUsd = todaySales?.reduce((sum, s) => sum + (Number(s.total_sales_usd) || 0), 0) ?? 0;
  const todayCashUsd = todayCash?.reduce((sum, c) => sum + (Number(c.amount_usd) || 0), 0) ?? 0;
  const cashVariance = todayCashUsd - todaySalesUsd;

  // Generate alerts
  const critPct = thresholds?.critical_pct ?? 20;
  const lowPct = thresholds?.low_pct ?? 30;

  const tankAlerts = (allTanks ?? [])
    .map(t => {
      const pct = (Number(t.current_level_usg) / Number(t.capacity_usg)) * 100;
      return { ...t, pct };
    })
    .filter(t => t.pct < lowPct)
    .sort((a, b) => a.pct - b.pct);

  const cashVarianceAlert = Math.abs(cashVariance) > 50 && todaySalesUsd > 0;

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <AppLayout title="Dashboard" subtitle="Real-time overview of all stations">
      {/* Notification Banner */}
      {(tankAlerts.length > 0 || cashVarianceAlert) && (
        <div className="mb-6 space-y-2">
          {tankAlerts.slice(0, 3).map(t => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-sm",
                t.pct < critPct
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "bg-warning/10 border-warning/30 text-warning"
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                <strong>{t.name}</strong> at {(t.branches as any)?.name} is at{" "}
                <strong>{t.pct.toFixed(0)}%</strong> capacity
                {t.pct < critPct ? " — Schedule delivery immediately!" : " — Monitor closely."}
              </span>
              <Badge variant="outline" className={cn(
                "text-xs",
                t.pct < critPct ? "border-destructive text-destructive" : "border-warning text-warning"
              )}>
                {t.pct < critPct ? "Critical" : "Low"}
              </Badge>
            </div>
          ))}
          {cashVarianceAlert && (
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border text-sm",
              cashVariance < 0
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-warning/10 border-warning/30 text-warning"
            )}>
              <DollarSign className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                <strong>Cash Variance Alert:</strong> Today's cash is{" "}
                <strong>{cashVariance >= 0 ? "+" : ""}${cashVariance.toFixed(2)}</strong> vs recorded sales.
                {Math.abs(cashVariance) > 200 ? " Investigate immediately." : " Review at end of day."}
              </span>
              <Badge variant="outline" className="border-warning text-warning text-xs">Variance</Badge>
            </div>
          )}
        </div>
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Sales Today"
          value={`$${todaySalesUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-6 w-6" />}
          variant="primary"
          subtitle={todaySalesUsd === 0 ? "No sales recorded yet" : undefined}
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
          <CashSummary
            cashLRD={todayCash?.filter(c => c.deposit_type === "LRD").reduce((s, c) => s + Number(c.amount), 0) ?? 0}
            cashUSD={todayCash?.filter(c => c.deposit_type === "USD").reduce((s, c) => s + Number(c.amount), 0) ?? 0}
            cardSalesUSD={todayCash?.filter(c => c.deposit_type === "Card").reduce((s, c) => s + Number(c.amount), 0) ?? 0}
            exchangeRate={192}
          />
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

        {/* Real-time Alerts Panel */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Live Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tankAlerts.length === 0 && !cashVarianceAlert ? (
                <div className="text-center py-6">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
                    <Fuel className="h-5 w-5 text-success" />
                  </div>
                  <p className="text-sm font-medium">All Clear</p>
                  <p className="text-xs text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                <>
                  {tankAlerts.map(t => (
                    <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                      <div className={cn(
                        "h-2 w-2 rounded-full mt-1.5 shrink-0",
                        t.pct < critPct ? "bg-destructive animate-pulse" : "bg-warning"
                      )} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{(t.branches as any)?.name} · {t.pct.toFixed(0)}% · {t.product_type}</p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px] shrink-0 ml-auto",
                        t.pct < critPct ? "border-destructive text-destructive" : "border-warning text-warning"
                      )}>
                        {t.pct < critPct ? "CRIT" : "LOW"}
                      </Badge>
                    </div>
                  ))}
                  {cashVarianceAlert && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                      <div className="h-2 w-2 rounded-full mt-1.5 shrink-0 bg-warning" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Cash Variance</p>
                        <p className="text-xs text-muted-foreground">
                          {cashVariance >= 0 ? "+" : ""}${cashVariance.toFixed(2)} today
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-auto border-warning text-warning">VAR</Badge>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <BranchPerformance />
    </AppLayout>
  );
}

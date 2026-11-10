import { ZoneAlertsCard } from "@/components/dashboard/RoleCards";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupervisorZone } from "@/hooks/useSupervisorZone";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, DollarSign, Fuel, AlertTriangle, MapPin, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function SupervisorDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { zone, zoneBranches, zoneBranchIds } = useSupervisorZone();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const activeBranchIds = useMemo(
    () => (selectedBranch === "all" ? zoneBranchIds : [selectedBranch]),
    [selectedBranch, zoneBranchIds]
  );

  const { data: tanks } = useQuery({
    queryKey: ["sup-tanks", activeBranchIds],
    enabled: activeBranchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks")
        .select("id, name, product_type, current_level_usg, capacity_usg, branch_id, branches(name)")
        .in("branch_id", activeBranchIds)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: todaySales } = useQuery({
    queryKey: ["sup-sales", today, activeBranchIds],
    enabled: activeBranchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_sales_reports")
        .select("branch_id, total_sales_usd, sales_usg")
        .eq("date", today)
        .in("branch_id", activeBranchIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["sup-alerts", activeBranchIds],
    enabled: activeBranchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliation_alerts")
        .select("id, branch_id, resolved_at")
        .in("branch_id", activeBranchIds)
        .is("resolved_at", null);
      if (error) return [];
      return data ?? [];
    },
  });

  const totalSalesUsd = todaySales?.reduce((s, r) => s + Number(r.total_sales_usd || 0), 0) ?? 0;
  const totalUsg = todaySales?.reduce((s, r) => s + Number(r.sales_usg || 0), 0) ?? 0;
  const avgFill = tanks && tanks.length
    ? (tanks.reduce((s, t) => s + (Number(t.current_level_usg) / Number(t.capacity_usg)) * 100, 0) / tanks.length)
    : 0;

  const perBranch = useMemo(() => {
    return zoneBranches.map((b) => {
      const bTanks = (tanks ?? []).filter((t) => t.branch_id === b.id);
      const bSales = (todaySales ?? []).filter((s) => s.branch_id === b.id);
      const bAlerts = (alerts ?? []).filter((a) => a.branch_id === b.id);
      const fill = bTanks.length
        ? bTanks.reduce((s, t) => s + (Number(t.current_level_usg) / Number(t.capacity_usg)) * 100, 0) / bTanks.length
        : 0;
      return {
        ...b,
        sales: bSales.reduce((s, r) => s + Number(r.total_sales_usd || 0), 0),
        fillPct: fill,
        alertCount: bAlerts.length,
        tankCount: bTanks.length,
      };
    });
  }, [zoneBranches, tanks, todaySales, alerts]);

  const zoneLabel = zone ? zone.charAt(0).toUpperCase() + zone.slice(1) : "—";

  return (
    <AppLayout
      title={`${zoneLabel} Zone`}
      subtitle={`Supervisor overview · ${zoneBranches.length} station${zoneBranches.length === 1 ? "" : "s"}`}
    >
      {/* Branch switcher */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-sm text-muted-foreground">Viewing:</span>
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stations in {zoneLabel} zone</SelectItem>
            {zoneBranches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {zoneBranches.length === 0 && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center text-muted-foreground">
            No stations assigned to your zone yet. Contact your administrator.
          </CardContent>
        </Card>
      )}

      {/* Roll-up */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-grid">
        <MetricCard title="Sales Today" value={`$${totalSalesUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={<DollarSign className="h-6 w-6" />} variant="primary" />
        <MetricCard title="Volume Sold" value={`${totalUsg.toLocaleString(undefined, { maximumFractionDigits: 0 })} USG`} icon={<Fuel className="h-6 w-6" />} variant="success" />
        <MetricCard title="Avg Tank Fill" value={`${avgFill.toFixed(0)}%`} icon={<Fuel className="h-6 w-6" />} variant="warning" />
        <MetricCard title="Pending Alerts" value={String(alerts?.length ?? 0)} icon={<AlertTriangle className="h-6 w-6" />} />
      </div>

      {/* Per-branch grid — hidden when a single branch is selected */}
      {selectedBranch === "all" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Stations in {zoneLabel} zone</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-grid">
            {perBranch.map((b) => (
              <Card key={b.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 truncate">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{b.name}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {b.county}{b.location ? ` · ${b.location}` : ""}
                      </p>
                    </div>
                    {b.alertCount > 0 && (
                      <Badge variant="outline" className="border-destructive text-destructive text-xs">
                        {b.alertCount} alert{b.alertCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 stagger-grid">
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Sales today</p>
                      <p className="text-lg font-semibold">${b.sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Avg fill</p>
                      <p className="text-lg font-semibold">{b.tankCount ? `${b.fillPct.toFixed(0)}%` : "—"}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedBranch(b.id)}
                  >
                    View station <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Single-branch drill-down: link into detail pages */}
      {selectedBranch !== "all" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links (read-only)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-grid">
            <Button variant="outline" asChild><Link to="/tanks">Tanks</Link></Button>
            <Button variant="outline" asChild><Link to="/shift-stock-report">Shift Report</Link></Button>
            <Button variant="outline" asChild><Link to="/cash">Cash Reports</Link></Button>
            <Button variant="outline" asChild><Link to="/deliveries">Deliveries</Link></Button>
            <Button variant="outline" asChild><Link to="/employees">Employees</Link></Button>
            <Button variant="outline" asChild><Link to="/payroll">Payroll</Link></Button>
            <Button variant="outline" asChild><Link to="/profit-loss">P&amp;L</Link></Button>
            <Button variant="outline" asChild><Link to="/reports">Reports</Link></Button>
          </CardContent>
        </Card>
      )}
      <ZoneAlertsCard />
    </AppLayout>
  );
}
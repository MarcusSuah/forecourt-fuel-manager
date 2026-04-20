import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { useDismissedNotifications } from "@/hooks/useDismissedNotifications";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Bell, BellOff, Droplets, Truck, DollarSign, CheckCircle2, X, Eye, Undo2, ShieldAlert, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  type: "tank-critical" | "tank-low" | "delivery" | "cash-variance" | "dip-variance" | "reconciliation";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  branchName: string;
  timestamp: string;
  link?: string;
};

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDealer, dealerBranchId, dealerBranchName } = useDealerBranch();
  const { dismissedKeys, dismiss, dismissMany, restoreAll } = useDismissedNotifications();
  const { supported: desktopSupported, permission: desktopPermission, enabled: desktopEnabled, setEnabled: setDesktopEnabled, requestPermission, notify: desktopNotify } = useDesktopNotifications();
  const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: thresholds } = useQuery({
    queryKey: ["tank-thresholds-notifs"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "tank_thresholds").single();
      return (data?.value as { critical_pct: number; low_pct: number }) ?? { critical_pct: 20, low_pct: 30 };
    },
  });

  const { data: tanks, isLoading: tanksLoading } = useQuery({
    queryKey: ["notifs-tanks", dealerBranchId],
    queryFn: async () => {
      let q = supabase.from("tanks")
        .select("id, name, product_type, current_level_usg, capacity_usg, updated_at, branches(name)")
        .eq("is_active", true);
      if (isDealer && dealerBranchId) q = q.eq("branch_id", dealerBranchId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveries, isLoading: delsLoading } = useQuery({
    queryKey: ["notifs-deliveries", dealerBranchId],
    queryFn: async () => {
      let q = supabase.from("fuel_deliveries")
        .select("id, delivery_date, created_at, quantity_usg, supplier, receipt_number, tanks(name), branches(name)")
        .gte("delivery_date", sevenDaysAgo)
        .order("created_at", { ascending: false });
      if (isDealer && dealerBranchId) q = q.eq("branch_id", dealerBranchId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: cashSales } = useQuery({
    queryKey: ["notifs-cash-variance", dealerBranchId, today],
    queryFn: async () => {
      let cashQ = supabase.from("cash_deposits").select("amount_usd, branch_id, branches(name)").eq("date", today);
      let salesQ = supabase.from("shift_sales_reports").select("total_sales_usd, branch_id, branches(name)").eq("date", today);
      if (isDealer && dealerBranchId) {
        cashQ = cashQ.eq("branch_id", dealerBranchId);
        salesQ = salesQ.eq("branch_id", dealerBranchId);
      }
      const [cashRes, salesRes] = await Promise.all([cashQ, salesQ]);
      if (cashRes.error) throw cashRes.error;
      if (salesRes.error) throw salesRes.error;
      return { cash: cashRes.data ?? [], sales: salesRes.data ?? [] };
    },
  });

  // Realtime: refresh notifications when underlying tables change
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tanks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifs-tanks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fuel_deliveries" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifs-deliveries"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_deposits" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifs-cash-variance"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_sales_reports" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifs-cash-variance"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const notifications = useMemo<Notification[]>(() => {
    const list: Notification[] = [];
    const critPct = thresholds?.critical_pct ?? 20;
    const lowPct = thresholds?.low_pct ?? 30;

    (tanks ?? []).forEach((t) => {
      const pct = (Number(t.current_level_usg) / Number(t.capacity_usg)) * 100;
      const branchName = (t.branches as any)?.name ?? "Unknown";
      if (pct < critPct) {
        list.push({
          id: `tank-crit-${t.id}`,
          type: "tank-critical",
          severity: "critical",
          title: `${t.name} is critically low`,
          description: `${t.product_type} at ${pct.toFixed(0)}% (${Number(t.current_level_usg).toLocaleString()} / ${Number(t.capacity_usg).toLocaleString()} USG). Schedule delivery immediately.`,
          branchName,
          timestamp: t.updated_at as string,
          link: "/tanks",
        });
      } else if (pct < lowPct) {
        list.push({
          id: `tank-low-${t.id}`,
          type: "tank-low",
          severity: "warning",
          title: `${t.name} is running low`,
          description: `${t.product_type} at ${pct.toFixed(0)}% capacity. Monitor closely.`,
          branchName,
          timestamp: t.updated_at as string,
          link: "/tanks",
        });
      }
    });

    (deliveries ?? []).forEach((d) => {
      list.push({
        id: `del-${d.id}`,
        type: "delivery",
        severity: "info",
        title: `Delivery received: ${Number(d.quantity_usg).toLocaleString()} USG`,
        description: `${(d.tanks as any)?.name ?? "Tank"}${d.supplier ? ` from ${d.supplier}` : ""}${d.receipt_number ? ` (#${d.receipt_number})` : ""}`,
        branchName: (d.branches as any)?.name ?? "Unknown",
        timestamp: d.created_at as string,
        link: "/deliveries",
      });
    });

    if (cashSales) {
      // Group by branch
      const byBranch = new Map<string, { name: string; cash: number; sales: number }>();
      cashSales.cash.forEach((c) => {
        const id = c.branch_id;
        const name = (c.branches as any)?.name ?? "Unknown";
        if (!byBranch.has(id)) byBranch.set(id, { name, cash: 0, sales: 0 });
        byBranch.get(id)!.cash += Number(c.amount_usd) || 0;
      });
      cashSales.sales.forEach((s) => {
        const id = s.branch_id;
        const name = (s.branches as any)?.name ?? "Unknown";
        if (!byBranch.has(id)) byBranch.set(id, { name, cash: 0, sales: 0 });
        byBranch.get(id)!.sales += Number(s.total_sales_usd) || 0;
      });
      byBranch.forEach((v, id) => {
        const variance = v.cash - v.sales;
        if (Math.abs(variance) > 50 && v.sales > 0) {
          list.push({
            id: `cash-var-${id}`,
            type: "cash-variance",
            severity: variance < 0 ? "critical" : "warning",
            title: "Cash variance detected today",
            description: `Cash deposited (${v.cash.toFixed(2)}) ${variance >= 0 ? "exceeds" : "is short of"} recorded sales (${v.sales.toFixed(2)}) by $${Math.abs(variance).toFixed(2)}.`,
            branchName: v.name,
            timestamp: new Date().toISOString(),
            link: "/cash",
          });
        }
      });
    }

    const visible = list.filter((n) => !dismissedKeys.has(n.id));
    return visible.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2, success: 3 };
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [tanks, deliveries, cashSales, thresholds, dismissedKeys]);

  const isLoading = tanksLoading || delsLoading;

  const filterByType = (type: string) => {
    if (type === "all") return notifications;
    if (type === "alerts") return notifications.filter(n => n.severity === "critical" || n.severity === "warning");
    if (type === "tanks") return notifications.filter(n => n.type === "tank-critical" || n.type === "tank-low");
    if (type === "deliveries") return notifications.filter(n => n.type === "delivery");
    if (type === "cash") return notifications.filter(n => n.type === "cash-variance");
    return notifications;
  };

  const subtitle = isDealer && dealerBranchName
    ? `${dealerBranchName} — All alerts and activity for your station`
    : "All alerts and activity across stations";

  const renderList = (items: Notification[]) => {
    if (isLoading) {
      return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <p className="font-medium">All clear</p>
          <p className="text-sm text-muted-foreground">No notifications in this category.</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((n) => {
          const Icon = n.type === "delivery" ? Truck
            : n.type === "cash-variance" ? DollarSign
            : n.type.startsWith("tank") ? Droplets
            : AlertTriangle;
          const tone = n.severity === "critical" ? "bg-destructive/10 border-destructive/30 text-destructive"
            : n.severity === "warning" ? "bg-warning/10 border-warning/30 text-warning"
            : n.severity === "success" ? "bg-success/10 border-success/30 text-success"
            : "bg-muted/50 border-border text-foreground";
          return (
            <div
              key={n.id}
              className={cn("group w-full flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/30", tone)}
            >
              <button
                type="button"
                onClick={() => n.link && navigate(n.link)}
                className="flex items-start gap-3 flex-1 min-w-0 text-left"
              >
                <div className="h-8 w-8 rounded-full bg-background/60 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm">{n.title}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{n.severity}</Badge>
                  </div>
                  <p className="text-xs mt-0.5 text-foreground/80">{n.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {n.branchName} · {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100"
                title="Dismiss"
                onClick={(e) => { e.stopPropagation(); dismiss({ key: n.id, type: n.type }); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppLayout title="Notifications" subtitle={subtitle}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Activity Center
              {notifications.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">{notifications.length}</Badge>
              )}
              {dismissedKeys.size > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  <Eye className="h-3 w-3 mr-1" />{dismissedKeys.size} dismissed
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {notifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => dismissMany(notifications.map((n) => ({ key: n.id, type: n.type })))}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark all as read
                </Button>
              )}
              {dismissedKeys.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => restoreAll()}
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" /> Restore dismissed
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
              <TabsTrigger value="alerts">Alerts ({filterByType("alerts").length})</TabsTrigger>
              <TabsTrigger value="tanks">Tanks ({filterByType("tanks").length})</TabsTrigger>
              <TabsTrigger value="deliveries">Deliveries ({filterByType("deliveries").length})</TabsTrigger>
              <TabsTrigger value="cash">Cash ({filterByType("cash").length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all">{renderList(notifications)}</TabsContent>
            <TabsContent value="alerts">{renderList(filterByType("alerts"))}</TabsContent>
            <TabsContent value="tanks">{renderList(filterByType("tanks"))}</TabsContent>
            <TabsContent value="deliveries">{renderList(filterByType("deliveries"))}</TabsContent>
            <TabsContent value="cash">{renderList(filterByType("cash"))}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

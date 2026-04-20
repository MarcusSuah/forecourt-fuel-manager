import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Activity, Loader2, RefreshCw, Search, Users } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  format, formatDistanceToNow, startOfDay, startOfMonth, startOfYear, subDays,
  eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth,
} from "date-fns";

type LoginRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_full_name: string | null;
  role: string | null;
  user_agent: string | null;
  created_at: string;
};

type RangeKey = "today" | "7d" | "30d" | "month" | "year";

const ranges: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

function getStartDate(range: RangeKey): Date {
  const now = new Date();
  switch (range) {
    case "today": return startOfDay(now);
    case "7d": return startOfDay(subDays(now, 6));
    case "30d": return startOfDay(subDays(now, 29));
    case "month": return startOfMonth(now);
    case "year": return startOfYear(now);
  }
}

const roleColor: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  supervisor: "bg-warning/10 text-warning border-warning/30",
  dealer: "bg-success/10 text-success border-success/30",
  cashier: "bg-secondary text-secondary-foreground",
  attendant: "bg-muted text-muted-foreground",
};

export default function AdminLoginActivities() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("7d");
  const [filter, setFilter] = useState("");

  const isAdmin = user?.role === "admin";

  const startDate = useMemo(() => getStartDate(range), [range]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-login-activities", range],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_activities")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LoginRow[];
    },
  });

  // Realtime: new logins push toast + refresh
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-login-activities-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "login_activities" },
        (payload) => {
          const row = payload.new as LoginRow;
          toast({
            title: "New sign-in",
            description: `${row.user_full_name ?? row.user_email ?? "A user"} just signed in${row.role ? ` as ${row.role}` : ""}.`,
          });
          qc.invalidateQueries({ queryKey: ["admin-login-activities"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, qc, toast]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.user_email, r.user_full_name, r.role]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(f)),
    );
  }, [rows, filter]);

  // Build chart series — daily for short ranges, monthly for "year"
  const chartData = useMemo(() => {
    const now = new Date();
    const list = rows ?? [];
    if (range === "year") {
      const months = eachMonthOfInterval({ start: startDate, end: now });
      return months.map((m) => ({
        label: format(m, "MMM"),
        logins: list.filter((r) => isSameMonth(new Date(r.created_at), m)).length,
      }));
    }
    if (range === "today") {
      // Hour buckets for today
      const buckets = Array.from({ length: 24 }, (_, h) => ({
        label: `${h.toString().padStart(2, "0")}h`,
        logins: 0,
      }));
      list.forEach((r) => {
        const h = new Date(r.created_at).getHours();
        buckets[h].logins++;
      });
      return buckets;
    }
    const days = eachDayOfInterval({ start: startDate, end: now });
    return days.map((d) => ({
      label: format(d, days.length > 14 ? "MMM d" : "EEE d"),
      logins: list.filter((r) => isSameDay(new Date(r.created_at), d)).length,
    }));
  }, [rows, range, startDate]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const uniqueUsers = new Set(list.map((r) => r.user_id)).size;
    const byRole = new Map<string, number>();
    list.forEach((r) => {
      const k = r.role ?? "unknown";
      byRole.set(k, (byRole.get(k) ?? 0) + 1);
    });
    return { total: list.length, uniqueUsers, byRole: Array.from(byRole.entries()) };
  }, [rows]);

  // Access guard runs after all hooks
  if (user && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout title="Login Activities" subtitle="Audit trail of all user sign-ins">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Login Activities
            </h1>
            <p className="text-muted-foreground text-sm">
              Real-time monitoring of every user sign-in across the system.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <TabsList>
                {ranges.map((r) => (
                  <TabsTrigger key={r.key} value={r.key} className="text-xs">
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-login-activities"] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Total sign-ins</p>
              <p className="text-2xl font-bold">{totals.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Unique users</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                {totals.uniqueUsers}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground mb-2">By role</p>
              <div className="flex flex-wrap gap-1.5">
                {totals.byRole.length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  totals.byRole.map(([role, count]) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className={`capitalize text-xs ${roleColor[role] ?? ""}`}
                    >
                      {role}: {count}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign-ins over time</CardTitle>
            <CardDescription>
              {ranges.find((r) => r.key === range)?.label} — bucketed by{" "}
              {range === "today" ? "hour" : range === "year" ? "month" : "day"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                    }}
                  />
                  <Bar dataKey="logins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base">Recent sign-ins</CardTitle>
                <CardDescription>
                  Showing {filtered.length} of {rows?.length ?? 0} entries.
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search name, email, role…"
                  className="pl-8 w-[260px]"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">
                No sign-ins in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>At</TableHead>
                      <TableHead className="max-w-[280px]">Device</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.user_full_name ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.user_email ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.role ? (
                            <Badge
                              variant="outline"
                              className={`capitalize text-xs ${roleColor[r.role] ?? ""}`}
                            >
                              {r.role}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(r.created_at), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                          {r.user_agent ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
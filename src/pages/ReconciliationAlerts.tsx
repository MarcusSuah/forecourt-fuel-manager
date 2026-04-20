import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { CalendarIcon, ShieldAlert, CheckCircle2, Filter, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AlertRow = {
  id: string;
  branch_id: string;
  tank_id: string;
  loss_usg: number;
  threshold_usg: number;
  severity: string;
  notification_status: string | null;
  notification_error: string | null;
  notified_emails: string[] | null;
  notified_phones: string[] | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  branches: { name: string } | null;
  tanks: { name: string; product_type: string } | null;
};

type StatusFilter = "all" | "open" | "resolved";
type SeverityFilter = "all" | "critical" | "warning";

export default function ReconciliationAlerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isDealer, dealerBranchId } = useDealerBranch();

  const canResolve = user?.role === "admin" || user?.role === "supervisor";

  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());

  const [resolvingAlert, setResolvingAlert] = useState<AlertRow | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Force dealer to their own branch
  useEffect(() => {
    if (isDealer && dealerBranchId) setBranchFilter(dealerBranchId);
  }, [isDealer, dealerBranchId]);

  const { data: branches } = useQuery({
    queryKey: ["branches-for-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts, isLoading } = useQuery<AlertRow[]>({
    queryKey: ["reconciliation-alerts", branchFilter, severityFilter, statusFilter, fromDate, toDate, dealerBranchId, isDealer],
    queryFn: async () => {
      let q = supabase
        .from("reconciliation_alerts")
        .select(`
          id, branch_id, tank_id, loss_usg, threshold_usg, severity,
          notification_status, notification_error, notified_emails, notified_phones,
          created_at, resolved_at, resolved_by, resolution_notes,
          branches(name), tanks(name, product_type)
        `)
        .order("created_at", { ascending: false });

      if (isDealer && dealerBranchId) q = q.eq("branch_id", dealerBranchId);
      else if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);

      if (severityFilter !== "all") q = q.eq("severity", severityFilter);

      if (statusFilter === "open") q = q.is("resolved_at", null);
      else if (statusFilter === "resolved") q = q.not("resolved_at", "is", null);

      if (fromDate) q = q.gte("created_at", fromDate.toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AlertRow[];
    },
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("reconciliation-alerts-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "reconciliation_alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("reconciliation_alerts")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert marked as resolved");
      queryClient.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
      setResolvingAlert(null);
      setResolutionNotes("");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to resolve alert"),
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reconciliation_alerts")
        .update({ resolved_at: null, resolved_by: null, resolution_notes: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert reopened");
      queryClient.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to reopen alert"),
  });

  const summary = useMemo(() => {
    const total = alerts?.length ?? 0;
    const open = alerts?.filter((a) => !a.resolved_at).length ?? 0;
    const critical = alerts?.filter((a) => a.severity === "critical" && !a.resolved_at).length ?? 0;
    const totalLoss = alerts?.reduce((sum, a) => sum + Number(a.loss_usg ?? 0), 0) ?? 0;
    return { total, open, critical, totalLoss };
  }, [alerts]);

  const resetFilters = () => {
    if (!isDealer) setBranchFilter("all");
    setSeverityFilter("all");
    setStatusFilter("open");
    setFromDate(subDays(new Date(), 30));
    setToDate(new Date());
  };

  return (
    <AppLayout title="Reconciliation Alerts" subtitle="Investigate and resolve flagged variance events">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              Reconciliation Alerts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Investigate and resolve flagged variance events across stations.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total in range</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Open</p>
              <p className="text-2xl font-bold text-amber-600">{summary.open}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Critical (open)</p>
              <p className="text-2xl font-bold text-destructive">{summary.critical}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total loss (USG)</p>
              <p className="text-2xl font-bold">{summary.totalLoss.toFixed(1)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Branch</Label>
                <Select value={branchFilter} onValueChange={setBranchFilter} disabled={isDealer}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "PP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "PP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
            <CardDescription>
              {isLoading ? "Loading…" : `${alerts?.length ?? 0} record(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Tank</TableHead>
                      <TableHead className="text-right">Loss (USG)</TableHead>
                      <TableHead className="text-right">Threshold</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Notify</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((a) => {
                      const isResolved = !!a.resolved_at;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>{a.branches?.name ?? "—"}</TableCell>
                          <TableCell>
                            {a.tanks?.name ?? "—"}
                            {a.tanks?.product_type && (
                              <Badge variant="outline" className="ml-2 text-[10px]">{a.tanks.product_type}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {Number(a.loss_usg).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {Number(a.threshold_usg).toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="capitalize">
                              {a.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize text-[10px]",
                                a.notification_status === "sent" && "border-green-500/40 text-green-700 dark:text-green-400",
                                a.notification_status === "failed" && "border-destructive/40 text-destructive",
                              )}
                              title={a.notification_error ?? undefined}
                            >
                              {a.notification_status ?? "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isResolved ? (
                              <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                                Open
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!isResolved ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!canResolve}
                                onClick={() => { setResolvingAlert(a); setResolutionNotes(""); }}
                              >
                                Mark resolved
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!canResolve || reopenMutation.isPending}
                                onClick={() => reopenMutation.mutate(a.id)}
                              >
                                Reopen
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500/60" />
                <p className="text-sm">No alerts match the selected filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resolve dialog */}
      <Dialog open={!!resolvingAlert} onOpenChange={(o) => !o && setResolvingAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark alert as resolved</DialogTitle>
            <DialogDescription>
              {resolvingAlert && (
                <>
                  {resolvingAlert.tanks?.name} at {resolvingAlert.branches?.name} — loss of{" "}
                  <strong className="text-destructive">{Number(resolvingAlert.loss_usg).toFixed(1)} USG</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="notes">Investigation notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="What was investigated? Root cause? Action taken?"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvingAlert(null)}>Cancel</Button>
            <Button
              onClick={() => resolvingAlert && resolveMutation.mutate({ id: resolvingAlert.id, notes: resolutionNotes })}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

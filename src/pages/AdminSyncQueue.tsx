import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, Trash2, Eye, ShieldAlert, Loader2, Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  client_entry_id: string;
  user_id: string;
  user_email: string | null;
  target_table: string;
  payload: any;
  label: string;
  status: "pending" | "syncing" | "failed" | "succeeded";
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const statusVariant: Record<Row["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  syncing: "default",
  failed: "destructive",
  succeeded: "outline",
};

export default function AdminSyncQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [inspect, setInspect] = useState<Row | null>(null);

  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-sync-queue"],
    enabled: isAdmin || isSupervisor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.user_email, r.target_table, r.label, r.status, r.last_error]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(f)),
    );
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { pending: 0, syncing: 0, failed: 0, succeeded: 0 };
    (rows ?? []).forEach((r) => { c[r.status]++; });
    return c;
  }, [rows]);

  const action = useMutation({
    mutationFn: async (vars: { action: "retry" | "discard"; ids: string[] }) => {
      const { data, error } = await supabase.functions.invoke("sync-queue-replay", {
        body: vars,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.action === "retry" ? "Replay complete" : "Entries discarded",
        description: `${vars.ids.length} entr${vars.ids.length === 1 ? "y" : "ies"} processed.`,
      });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-sync-queue"] });
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  // Access guard runs after all hooks have been called
  if (user && !isAdmin && !isSupervisor) {
    return <Navigate to="/dashboard" replace />;
  }

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectedIds = Array.from(selected);

  return (
    <AppLayout title="Sync Queue" subtitle="Cross-user offline entry diagnostics">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-7 w-7 text-primary" />
              Sync Queue
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Inspect and replay every offline-queued entry across all users."
                : "Read-only summary of offline-queued entries across all users."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-sync-queue"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["pending", "syncing", "failed", "succeeded"] as const).map((s) => (
            <Card key={s}>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">{s}</p>
                <p className="text-2xl font-bold">{counts[s]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Queued entries</CardTitle>
                <CardDescription>
                  Showing {filtered.length} of {rows?.length ?? 0} (latest 500).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search user, table, error…"
                    className="pl-8 w-[260px]"
                  />
                </div>
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedIds.length === 0 || action.isPending}
                      onClick={() => action.mutate({ action: "retry", ids: selectedIds })}
                    >
                      {action.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Retry ({selectedIds.length})
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={selectedIds.length === 0 || action.isPending}
                      onClick={() => action.mutate({ action: "discard", ids: selectedIds })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Discard ({selectedIds.length})
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No queued entries.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && (
                        <TableHead className="w-10">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                        </TableHead>
                      )}
                      <TableHead>Status</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last error</TableHead>
                      <TableHead className="text-right">Inspect</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        {isAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={selected.has(r.id)}
                              onCheckedChange={() => toggleOne(r.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={statusVariant[r.status]} className="capitalize">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.user_email ?? r.user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.target_table}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.label}</TableCell>
                        <TableCell className="text-right">{r.attempts}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-destructive">
                          {r.last_error ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin ? (
                            <Button variant="ghost" size="sm" onClick={() => setInspect(r)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Admin only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!inspect} onOpenChange={(o) => !o && setInspect(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Payload inspection</DialogTitle>
              <DialogDescription>
                {inspect?.target_table} · {inspect?.user_email ?? inspect?.user_id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Status:</span> {inspect?.status}</div>
                <div><span className="text-muted-foreground">Attempts:</span> {inspect?.attempts}</div>
                <div><span className="text-muted-foreground">Client ID:</span> <span className="font-mono text-xs">{inspect?.client_entry_id}</span></div>
                <div><span className="text-muted-foreground">Updated:</span> {inspect && formatDistanceToNow(new Date(inspect.updated_at), { addSuffix: true })}</div>
              </div>
              {inspect?.last_error && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Last error</p>
                  <pre className="bg-destructive/10 text-destructive p-3 rounded text-xs whitespace-pre-wrap">
                    {inspect.last_error}
                  </pre>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Payload</p>
                <pre className="bg-muted p-3 rounded text-xs max-h-[400px] overflow-auto">
                  {JSON.stringify(inspect?.payload, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
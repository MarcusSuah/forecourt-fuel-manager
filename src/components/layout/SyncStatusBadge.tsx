import { CloudOff, CloudCheck, RefreshCw, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { cn } from "@/lib/utils";

const TABLE_LABELS: Record<string, string> = {
  shift_sales_reports: "Sales entry",
  cash_deposits: "Cash deposit",
};

function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

/**
 * Shows a CloudOff icon in the header when the user is offline OR the queue
 * has pending/failed items. Click opens a popover listing each item with
 * Retry / Discard controls.
 */
export function SyncStatusBadge() {
  const { pending, failed, offline, syncNow, retry, discard } = useSyncQueue();
  const total = pending.length + failed.length;

  // Hide entirely when there's nothing to show and we're online
  if (!offline && total === 0) return null;

  const hasFailed = failed.length > 0;
  const iconClass = cn(
    "h-3.5 w-3.5 sm:h-4 sm:w-4",
    hasFailed ? "text-destructive" : offline ? "text-warning" : "text-muted-foreground",
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-card relative h-8 w-8 sm:h-9 sm:w-9"
          aria-label="Pending sync"
        >
          <CloudOff className={iconClass} />
          {total > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                hasFailed
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-warning text-warning-foreground",
              )}
            >
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              {offline ? (
                <><CloudOff className="h-4 w-4 text-warning" /> Offline</>
              ) : total === 0 ? (
                <><CloudCheck className="h-4 w-4 text-success" /> All synced</>
              ) : (
                <><CloudOff className="h-4 w-4 text-warning" /> Pending sync</>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              {pending.length > 0 && <>{pending.length} pending</>}
              {pending.length > 0 && failed.length > 0 && " · "}
              {failed.length > 0 && <span className="text-destructive">{failed.length} failed</span>}
              {total === 0 && offline && "Changes will sync when you reconnect"}
            </p>
          </div>
          {total > 0 && !offline && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => syncNow()}>
              <RefreshCw className="h-3 w-3 mr-1" /> Sync now
            </Button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {total === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {offline ? "No pending changes." : "Queue is empty."}
            </div>
          ) : (
            <>
              {pending.map((e) => (
                <div key={e.id} className="flex items-start gap-2 p-3 border-b border-border/50">
                  {e.status === "syncing" ? (
                    <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary animate-spin" />
                  ) : (
                    <div className="h-2 w-2 rounded-full mt-1.5 shrink-0 bg-warning" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {TABLE_LABELS[e.table] ?? e.table} · {relativeTime(e.createdAt)}
                      {e.attempts > 0 && ` · ${e.attempts} retr${e.attempts === 1 ? "y" : "ies"}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 border-warning text-warning">
                    {e.status === "syncing" ? "SYNCING" : "PENDING"}
                  </Badge>
                </div>
              ))}
              {failed.map((e) => (
                <div key={e.id} className="flex items-start gap-2 p-3 border-b border-border/50 bg-destructive/5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {TABLE_LABELS[e.table] ?? e.table} · {relativeTime(e.createdAt)}
                    </p>
                    {e.lastError && (
                      <p className="text-[11px] text-destructive mt-1 line-clamp-2">{e.lastError}</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => retry(e.id)}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive hover:text-destructive" onClick={() => discard(e.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Discard
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
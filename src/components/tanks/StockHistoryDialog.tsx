import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Droplets, Truck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StockHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tankId: string;
  tankName: string;
  capacity: number;
}

type HistoryEvent = {
  id: string;
  date: string;
  timestamp: string;
  type: "dip" | "delivery";
  label: string;
  qty: number;
  resultingLevel: number;
};

export function StockHistoryDialog({ open, onOpenChange, tankId, tankName, capacity }: StockHistoryDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["tank-stock-history", tankId],
    enabled: open && !!tankId,
    queryFn: async () => {
      const [dipsRes, delsRes] = await Promise.all([
        supabase
          .from("stock_readings")
          .select("id, date, created_at, physical_level_usg, theoretical_level_usg, shifts(name)")
          .eq("tank_id", tankId)
          .order("date", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("fuel_deliveries")
          .select("id, delivery_date, created_at, quantity_usg, supplier, receipt_number")
          .eq("tank_id", tankId)
          .order("delivery_date", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (dipsRes.error) throw dipsRes.error;
      if (delsRes.error) throw delsRes.error;

      const events: Array<{
        id: string;
        date: string;
        timestamp: string;
        type: "dip" | "delivery";
        physical?: number;
        qty?: number;
        label: string;
      }> = [
        ...(dipsRes.data ?? []).map((d) => ({
          id: `dip-${d.id}`,
          date: d.date as string,
          timestamp: d.created_at as string,
          type: "dip" as const,
          physical: Number(d.physical_level_usg),
          label: `Tank Dip${(d.shifts as any)?.name ? ` — ${(d.shifts as any).name}` : ""}`,
        })),
        ...(delsRes.data ?? []).map((x) => ({
          id: `del-${x.id}`,
          date: x.delivery_date as string,
          timestamp: x.created_at as string,
          type: "delivery" as const,
          qty: Number(x.quantity_usg),
          label: `Delivery${x.supplier ? ` — ${x.supplier}` : ""}${x.receipt_number ? ` (#${x.receipt_number})` : ""}`,
        })),
      ].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.timestamp.localeCompare(b.timestamp);
      });

      let running = 0;
      const computed: HistoryEvent[] = events.map((ev) => {
        if (ev.type === "dip") {
          running = ev.physical ?? running;
          return { id: ev.id, date: ev.date, timestamp: ev.timestamp, type: "dip", label: ev.label, qty: ev.physical ?? 0, resultingLevel: running };
        } else {
          running = Math.min(running + (ev.qty ?? 0), capacity);
          return { id: ev.id, date: ev.date, timestamp: ev.timestamp, type: "delivery", label: ev.label, qty: ev.qty ?? 0, resultingLevel: running };
        }
      });

      return computed.reverse();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Stock History — {tankName}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No dip readings or deliveries recorded for this tank yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(ev.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      {ev.type === "dip" ? (
                        <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary">
                          <Droplets className="h-3 w-3" /> Dip
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1 border-success/40 text-success">
                          <Truck className="h-3 w-3" /> Delivery
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{ev.label}</TableCell>
                    <TableCell className={cn("text-right font-medium text-sm",
                      ev.type === "delivery" ? "text-success" : "text-muted-foreground"
                    )}>
                      {ev.type === "delivery" ? `+${ev.qty.toLocaleString()}` : `→ ${ev.qty.toLocaleString()}`}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {ev.resultingLevel.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">USG</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

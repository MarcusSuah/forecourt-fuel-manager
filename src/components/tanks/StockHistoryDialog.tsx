import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Truck, Download, TrendingUp, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv-export";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

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
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

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
      return computed;
    },
  });

  // Filter by date range (chronological, ascending) for chart, then reversed for table
  const filteredAsc = useMemo(() => {
    if (!data) return [];
    return data.filter((ev) => ev.date >= dateFrom && ev.date <= dateTo);
  }, [data, dateFrom, dateTo]);

  // Compute dip-to-dip variance on the ascending list (vs previous dip), then reverse for display
  const filteredWithVariance = useMemo(() => {
    let prevDipLevel: number | null = null;
    return filteredAsc.map((ev) => {
      let dipVariance: number | null = null;
      if (ev.type === "dip") {
        if (prevDipLevel !== null) dipVariance = ev.qty - prevDipLevel;
        prevDipLevel = ev.qty;
      }
      return { ...ev, dipVariance };
    });
  }, [filteredAsc]);

  const filteredDesc = useMemo(() => [...filteredWithVariance].reverse(), [filteredWithVariance]);

  // Summary stats for the selected period
  const summary = useMemo(() => {
    const dips = filteredAsc.filter((e) => e.type === "dip");
    const dels = filteredAsc.filter((e) => e.type === "delivery");
    const totalDeliveries = dels.reduce((s, d) => s + d.qty, 0);
    const dipCount = dips.length;
    const deliveryCount = dels.length;
    const startLevel = filteredAsc[0]?.resultingLevel ?? 0;
    const endLevel = filteredAsc[filteredAsc.length - 1]?.resultingLevel ?? 0;
    const netChange = endLevel - startLevel;
    return { totalDeliveries, dipCount, deliveryCount, netChange };
  }, [filteredAsc]);

  const setPreset = (preset: "7d" | "30d" | "month" | "year") => {
    const now = new Date();
    setDateTo(format(now, "yyyy-MM-dd"));
    if (preset === "7d") setDateFrom(format(subDays(now, 7), "yyyy-MM-dd"));
    else if (preset === "30d") setDateFrom(format(subDays(now, 30), "yyyy-MM-dd"));
    else if (preset === "month") setDateFrom(format(startOfMonth(now), "yyyy-MM-dd"));
    else if (preset === "year") setDateFrom(format(startOfYear(now), "yyyy-MM-dd"));
  };

  const chartData = useMemo(
    () =>
      filteredAsc.map((ev) => ({
        date: format(new Date(ev.date), "MMM dd"),
        level: ev.resultingLevel,
        type: ev.type,
      })),
    [filteredAsc]
  );

  const handleExport = () => {
    downloadCSV(
      `stock-history-${tankName}-${dateFrom}-to-${dateTo}.csv`,
      ["Date", "Type", "Description", "Change (USG)", "Dip Variance (USG)", "Running Balance (USG)"],
      filteredDesc.map((ev) => [
        ev.date,
        ev.type === "dip" ? "Dip" : "Delivery",
        ev.label,
        ev.type === "delivery" ? `+${ev.qty}` : `=${ev.qty}`,
        ev.dipVariance === null || ev.dipVariance === undefined ? "" : (ev.dipVariance >= 0 ? `+${ev.dipVariance}` : `${ev.dipVariance}`),
        ev.resultingLevel,
      ])
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Stock History — {tankName}</DialogTitle>
        </DialogHeader>

        {/* Filters + Export */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-9 w-full sm:w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-9 w-full sm:w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!filteredDesc.length}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pt-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filteredAsc.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No events for the selected date range.
            </p>
          ) : (
            <>
              {/* Line Chart */}
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Tank Level Over Time</span>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [`${value.toLocaleString()} USG`, "Level"]}
                      />
                      <ReferenceLine y={capacity} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Capacity", fontSize: 10, fill: "hsl(var(--destructive))", position: "right" }} />
                      <Line type="monotone" dataKey="level" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Event Table */}
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
                  {filteredDesc.map((ev) => (
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

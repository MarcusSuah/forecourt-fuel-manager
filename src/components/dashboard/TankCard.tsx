import { cn } from "@/lib/utils";
import { Droplets, History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TankCardProps {
  name: string;
  product: "PMS" | "AGO";
  capacity: number;
  currentLevel: number;
  branch: string;
  lastUpdated?: string;
  onEdit?: () => void;
  onShowHistory?: () => void;
  // Stock breakdown (optional)
  latestDipDate?: string | null;
  openingLevel?: number | null;
  deliveriesSinceDip?: number | null;
  computedClosing?: number | null;
}

export function TankCard({
  name,
  product,
  capacity,
  currentLevel,
  branch,
  lastUpdated,
  onEdit,
  onShowHistory,
  latestDipDate,
  openingLevel,
  deliveriesSinceDip,
  computedClosing,
}: TankCardProps) {
  const percentage = Math.round((currentLevel / capacity) * 100);

  const getStatus = () => {
    if (percentage >= 70) return "full";
    if (percentage >= 30) return "medium";
    return "low";
  };

  const status = getStatus();

  const statusColors = {
    full: {
      bg: "bg-success",
      text: "text-success",
      badge: "bg-success/15 text-success",
      border: "border-success/30",
    },
    medium: {
      bg: "bg-warning",
      text: "text-warning",
      badge: "bg-warning/15 text-warning",
      border: "border-warning/30",
    },
    low: {
      bg: "bg-destructive",
      text: "text-destructive",
      badge: "bg-destructive/15 text-destructive",
      border: "border-destructive/30",
    },
  };

  const productColors = {
    PMS: "bg-fuel-pms",
    AGO: "bg-fuel-ago",
  };

  return (
    <div className={cn("metric-card border", statusColors[status].border)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              product === "PMS" ? "bg-fuel-pms/20" : "bg-fuel-ago/20"
            )}
          >
            <Droplets
              className={cn(
                "h-5 w-5",
                product === "PMS" ? "text-fuel-pms" : "text-fuel-ago"
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">{branch}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold uppercase",
              product === "PMS" ? "bg-fuel-pms/15 text-fuel-pms" : "bg-fuel-ago/15 text-fuel-ago"
            )}
          >
            {product}
          </span>
          {onShowHistory && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShowHistory} title="Stock history">
              <History className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tank Level Visualization */}
      <div className="relative h-32 w-full rounded-lg bg-muted/50 overflow-hidden border border-border/50 mb-4">
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out",
            productColors[product],
            "opacity-80"
          )}
          style={{ height: `${Math.min(percentage, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className="text-3xl font-bold text-foreground">{percentage}%</span>
          </div>
        </div>
        <div className="absolute left-0 right-0 top-[30%] border-t border-dashed border-foreground/10" />
        <div className="absolute left-0 right-0 top-[70%] border-t border-dashed border-foreground/10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Current</p>
          <p className="font-semibold text-foreground">{currentLevel.toLocaleString()} USG</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Capacity</p>
          <p className="font-semibold text-foreground">{capacity.toLocaleString()} USG</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mt-4 flex items-center justify-between">
        <span className={cn("status-badge capitalize", statusColors[status].badge)}>
          {status === "full" ? "Optimal" : status === "medium" ? "Moderate" : "Low Stock"}
        </span>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
        )}
      </div>
    </div>
  );
}

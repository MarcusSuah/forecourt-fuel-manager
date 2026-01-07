import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: "warning" | "error" | "success" | "info";
  title: string;
  message: string;
  timestamp: string;
  branch?: string;
}

interface AlertCardProps {
  alerts: Alert[];
}

export function AlertCard({ alerts }: AlertCardProps) {
  const getIcon = (type: Alert["type"]) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "error":
        return <XCircle className="h-4 w-4" />;
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
    }
  };

  const getStyles = (type: Alert["type"]) => {
    switch (type) {
      case "warning":
        return "bg-warning/10 text-warning border-warning/20";
      case "error":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "success":
        return "bg-success/10 text-success border-success/20";
      case "info":
        return "bg-info/10 text-info border-info/20";
    }
  };

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Active Alerts</h3>
        <span className="text-sm text-muted-foreground">{alerts.length} alerts</span>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              getStyles(alert.type)
            )}
          >
            <div className="mt-0.5">{getIcon(alert.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm text-foreground">{alert.title}</p>
                <span className="text-xs opacity-70 shrink-0">{alert.timestamp}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
              {alert.branch && (
                <span className="inline-block mt-1 text-xs bg-background/50 px-2 py-0.5 rounded">
                  {alert.branch}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

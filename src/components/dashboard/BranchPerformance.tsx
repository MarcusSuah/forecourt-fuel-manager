import { Building2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Branch {
  id: string;
  name: string;
  county: string;
  franchise: "Financial Dealer" | "Young Dealer" | "COCO Dealer";
  salesUSD: number;
  change: number;
  pmsStock: number;
  agoStock: number;
}

const branches: Branch[] = [
  {
    id: "1",
    name: "Monrovia Central",
    county: "Montserrado",
    franchise: "COCO Dealer",
    salesUSD: 12450,
    change: 8.2,
    pmsStock: 82,
    agoStock: 65,
  },
  {
    id: "2",
    name: "Buchanan Station",
    county: "Grand Bassa",
    franchise: "Financial Dealer",
    salesUSD: 8320,
    change: -3.4,
    pmsStock: 45,
    agoStock: 78,
  },
  {
    id: "3",
    name: "Gbarnga Station",
    county: "Bong",
    franchise: "Young Dealer",
    salesUSD: 6780,
    change: 12.1,
    pmsStock: 91,
    agoStock: 88,
  },
  {
    id: "4",
    name: "Kakata Station",
    county: "Margibi",
    franchise: "COCO Dealer",
    salesUSD: 5420,
    change: 5.6,
    pmsStock: 67,
    agoStock: 34,
  },
];

const franchiseColors = {
  "Financial Dealer": "bg-info/15 text-info",
  "Young Dealer": "bg-warning/15 text-warning",
  "COCO Dealer": "bg-success/15 text-success",
};

export function BranchPerformance() {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Branch Performance</h3>
        <button className="text-sm text-primary hover:underline">View all</button>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Franchise</th>
              <th className="text-right">Sales (USD)</th>
              <th className="text-right">PMS</th>
              <th className="text-right">AGO</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">{branch.county}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex px-2.5 py-1 rounded-full text-xs font-medium",
                      franchiseColors[branch.franchise]
                    )}
                  >
                    {branch.franchise}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-semibold">${branch.salesUSD.toLocaleString()}</span>
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-xs font-medium",
                        branch.change >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {branch.change >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(branch.change)}%
                    </span>
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          branch.pmsStock >= 70
                            ? "bg-success"
                            : branch.pmsStock >= 30
                            ? "bg-warning"
                            : "bg-destructive"
                        )}
                        style={{ width: `${branch.pmsStock}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">{branch.pmsStock}%</span>
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          branch.agoStock >= 70
                            ? "bg-success"
                            : branch.agoStock >= 30
                            ? "bg-warning"
                            : "bg-destructive"
                        )}
                        style={{ width: `${branch.agoStock}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">{branch.agoStock}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

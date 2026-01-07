import { AppLayout } from "@/components/layout/AppLayout";
import { TankCard } from "@/components/dashboard/TankCard";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tanks = [
  {
    name: "PMS-TANK-1",
    product: "PMS" as const,
    capacity: 20000,
    currentLevel: 16500,
    branch: "Monrovia Central",
    lastUpdated: "10 min ago",
  },
  {
    name: "PMS-TANK-2",
    product: "PMS" as const,
    capacity: 18000,
    currentLevel: 9800,
    branch: "Monrovia Central",
    lastUpdated: "10 min ago",
  },
  {
    name: "AGO-TANK-1",
    product: "AGO" as const,
    capacity: 15000,
    currentLevel: 4200,
    branch: "Monrovia Central",
    lastUpdated: "10 min ago",
  },
  {
    name: "PMS-TANK-3",
    product: "PMS" as const,
    capacity: 22000,
    currentLevel: 19800,
    branch: "Buchanan Station",
    lastUpdated: "25 min ago",
  },
  {
    name: "AGO-TANK-2",
    product: "AGO" as const,
    capacity: 12000,
    currentLevel: 10200,
    branch: "Buchanan Station",
    lastUpdated: "25 min ago",
  },
  {
    name: "PMS-TANK-4",
    product: "PMS" as const,
    capacity: 16000,
    currentLevel: 5600,
    branch: "Gbarnga Station",
    lastUpdated: "5 min ago",
  },
  {
    name: "AGO-TANK-3",
    product: "AGO" as const,
    capacity: 14000,
    currentLevel: 12600,
    branch: "Gbarnga Station",
    lastUpdated: "5 min ago",
  },
  {
    name: "PMS-TANK-5",
    product: "PMS" as const,
    capacity: 20000,
    currentLevel: 3200,
    branch: "Kakata Station",
    lastUpdated: "15 min ago",
  },
];

export default function Tanks() {
  return (
    <AppLayout title="Tank Management" subtitle="Monitor and manage fuel tank levels">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select defaultValue="all">
            <SelectTrigger className="w-44 bg-card">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              <SelectItem value="monrovia">Monrovia Central</SelectItem>
              <SelectItem value="buchanan">Buchanan Station</SelectItem>
              <SelectItem value="gbarnga">Gbarnga Station</SelectItem>
              <SelectItem value="kakata">Kakata Station</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger className="w-32 bg-card">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="pms">PMS Only</SelectItem>
              <SelectItem value="ago">AGO Only</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger className="w-36 bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="full">Full (70%+)</SelectItem>
              <SelectItem value="medium">Medium (30-70%)</SelectItem>
              <SelectItem value="low">Low (&lt;30%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Tank
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <p className="text-sm text-muted-foreground">Total Tanks</p>
          <p className="text-2xl font-bold text-foreground mt-1">{tanks.length}</p>
        </div>
        <div className="metric-card border-success/30">
          <p className="text-sm text-muted-foreground">Optimal (70%+)</p>
          <p className="text-2xl font-bold text-success mt-1">
            {tanks.filter((t) => (t.currentLevel / t.capacity) >= 0.7).length}
          </p>
        </div>
        <div className="metric-card border-warning/30">
          <p className="text-sm text-muted-foreground">Moderate (30-70%)</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {tanks.filter((t) => {
              const pct = t.currentLevel / t.capacity;
              return pct >= 0.3 && pct < 0.7;
            }).length}
          </p>
        </div>
        <div className="metric-card border-destructive/30">
          <p className="text-sm text-muted-foreground">Low Stock (&lt;30%)</p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {tanks.filter((t) => (t.currentLevel / t.capacity) < 0.3).length}
          </p>
        </div>
      </div>

      {/* Tank Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tanks.map((tank) => (
          <TankCard key={tank.name} {...tank} />
        ))}
      </div>
    </AppLayout>
  );
}

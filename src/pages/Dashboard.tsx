import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TankCard } from "@/components/dashboard/TankCard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { CashSummary } from "@/components/dashboard/CashSummary";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { BranchPerformance } from "@/components/dashboard/BranchPerformance";
import { Fuel, DollarSign, Users, Gauge } from "lucide-react";

const mockTanks = [
  {
    name: "PMS-TANK-1",
    product: "PMS" as const,
    capacity: 20000,
    currentLevel: 16500,
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
    name: "PMS-TANK-2",
    product: "PMS" as const,
    capacity: 18000,
    currentLevel: 9800,
    branch: "Buchanan Station",
    lastUpdated: "25 min ago",
  },
  {
    name: "AGO-TANK-2",
    product: "AGO" as const,
    capacity: 12000,
    currentLevel: 10200,
    branch: "Gbarnga Station",
    lastUpdated: "5 min ago",
  },
];

const mockAlerts = [
  {
    id: "1",
    type: "error" as const,
    title: "Low Stock Alert",
    message: "AGO-TANK-1 at Monrovia Central is below 30% capacity. Schedule delivery.",
    timestamp: "5 min ago",
    branch: "Monrovia Central",
  },
  {
    id: "2",
    type: "warning" as const,
    title: "Variance Detected",
    message: "PMS-PUMP-2 showing 2.3% variance between meter and tank readings.",
    timestamp: "15 min ago",
    branch: "Buchanan Station",
  },
  {
    id: "3",
    type: "success" as const,
    title: "Delivery Completed",
    message: "15,000 USG PMS delivered to Gbarnga Station successfully.",
    timestamp: "1 hour ago",
    branch: "Gbarnga Station",
  },
  {
    id: "4",
    type: "info" as const,
    title: "Shift Change",
    message: "Morning shift completed. 8 attendants clocked out.",
    timestamp: "2 hours ago",
  },
];

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard" subtitle="Real-time overview of all stations">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Sales Today"
          value="$32,950"
          icon={<DollarSign className="h-6 w-6" />}
          trend={{ value: 12.5, label: "vs yesterday" }}
          variant="primary"
        />
        <MetricCard
          title="Total PMS Stock"
          value="45,300 USG"
          icon={<Fuel className="h-6 w-6" />}
          subtitle="Across all stations"
          variant="success"
        />
        <MetricCard
          title="Total AGO Stock"
          value="28,600 USG"
          icon={<Fuel className="h-6 w-6" />}
          subtitle="Across all stations"
          variant="warning"
        />
        <MetricCard
          title="Active Attendants"
          value="24"
          icon={<Users className="h-6 w-6" />}
          subtitle="Across 8 stations"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Sales Chart - Takes 2 columns */}
        <div className="lg:col-span-2">
          <SalesChart />
        </div>

        {/* Cash Summary */}
        <div>
          <CashSummary
            cashLRD={1250000}
            cashUSD={8540}
            cardSalesUSD={3250}
            exchangeRate={192}
          />
        </div>
      </div>

      {/* Tank Status and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Tank Status</h2>
            <button className="text-sm text-primary hover:underline">View all tanks</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockTanks.map((tank) => (
              <TankCard key={tank.name} {...tank} />
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div>
          <AlertCard alerts={mockAlerts} />
        </div>
      </div>

      {/* Branch Performance */}
      <BranchPerformance />
    </AppLayout>
  );
}

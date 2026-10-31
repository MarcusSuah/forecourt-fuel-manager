import StationOverview from "./StationOverview";
import { StationPayrollCard } from "@/components/dashboard/StationPayrollCard";
/** Admin: network-wide overview across all stations. */
export default function AdminDashboard() {
  return <StationOverview extra={<StationPayrollCard />} />;
}

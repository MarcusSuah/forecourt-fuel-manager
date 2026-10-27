import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "./AdminDashboard";
import DealerDashboard from "./DealerDashboard";
import SupervisorDashboard from "./SupervisorDashboard";

/** Role-based dashboard router. */
export default function Dashboard() {
  const { user } = useAuth();
  switch (user?.role) {
    case "supervisor":
      return <SupervisorDashboard />;
    case "dealer":
      return <DealerDashboard />;
    default:
      return <AdminDashboard />;
  }
}

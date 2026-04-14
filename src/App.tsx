import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tanks from "./pages/Tanks";
import SalesEntry from "./pages/SalesEntry";
import CashReports from "./pages/CashReports";
import StockControl from "./pages/StockControl";
import Reports from "./pages/Reports";
import AdminUsers from "./pages/AdminUsers";
import Attendants from "./pages/Attendants";
import Branches from "./pages/Branches";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Deliveries from "./pages/Deliveries";
import Employees from "./pages/Employees";
import HRM from "./pages/HRM";
import Payroll from "./pages/Payroll";
import ProfitLoss from "./pages/ProfitLoss";
import FinancialSituation from "./pages/FinancialSituation";
import Chat from "./pages/Chat";
import Permissions from "./pages/Permissions";
import TankDipping from "./pages/TankDipping";
import MeterReading from "./pages/MeterReading";
import ShiftStockReport from "./pages/ShiftStockReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/tanks" element={<ProtectedRoute><Tanks /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><SalesEntry /></ProtectedRoute>} />
            <Route path="/cash" element={<ProtectedRoute><CashReports /></ProtectedRoute>} />
            <Route path="/stock" element={<ProtectedRoute><StockControl /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/attendants" element={<ProtectedRoute><Attendants /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
            <Route path="/deliveries" element={<ProtectedRoute><Deliveries /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/hrm" element={<ProtectedRoute><HRM /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
            <Route path="/profit-loss" element={<ProtectedRoute><ProfitLoss /></ProtectedRoute>} />
            <Route path="/financial-situation" element={<ProtectedRoute><FinancialSituation /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute><Permissions /></ProtectedRoute>} />
            <Route path="/tank-dipping" element={<ProtectedRoute><TankDipping /></ProtectedRoute>} />
            <Route path="/meter-reading" element={<ProtectedRoute><MeterReading /></ProtectedRoute>} />
            <Route path="/shift-stock-report" element={<ProtectedRoute><ShiftStockReport /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

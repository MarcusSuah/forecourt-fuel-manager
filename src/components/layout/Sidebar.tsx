import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Fuel, Users, Building2, Receipt, Wallet,
  FileBarChart, Settings, ChevronLeft, ChevronRight, Droplets,
  TrendingUp, LogOut, ShieldCheck, Truck, UserCog, CalendarDays,
  DollarSign, PieChart, Landmark, MessageCircle, Lock, Gauge,
  ClipboardList, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerBranch } from "@/hooks/useDealerBranch";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: null },
  { name: "Branches", href: "/branches", icon: Building2, permission: "branches.view" },
  { name: "Tank Management", href: "/tanks", icon: Droplets, permission: "tanks.view" },
  { name: "Tank Dipping", href: "/tank-dipping", icon: Droplets, permission: "tanks.view" },
  { name: "Meter Readings", href: "/meter-reading", icon: Gauge, permission: "sales.view" },
  { name: "Shift Stock Report", href: "/shift-stock-report", icon: ClipboardList, permission: "stock.view" },
  { name: "Sales Entry", href: "/sales", icon: Receipt, permission: "sales.manage" },
  { name: "Cash Reports", href: "/cash", icon: Wallet, permission: "cash.manage" },
  { name: "Stock Control", href: "/stock", icon: Fuel, permission: "stock.view" },
  { name: "Deliveries", href: "/deliveries", icon: Truck, permission: "deliveries.view" },
  { name: "Employees", href: "/employees", icon: UserCog, permission: "employees.view" },
  { name: "HRM", href: "/hrm", icon: CalendarDays, permission: "employees.view" },
  { name: "Payroll", href: "/payroll", icon: DollarSign, permission: "payroll.view" },
  { name: "Profit & Loss", href: "/profit-loss", icon: PieChart, permission: "financials.view" },
  { name: "Financial", href: "/financial-situation", icon: Landmark, permission: "financials.view" },
  { name: "Reports", href: "/reports", icon: FileBarChart, permission: "reports.view" },
  { name: "Attendants", href: "/attendants", icon: Users, permission: "attendants.view" },
  { name: "Analytics", href: "/analytics", icon: TrendingUp, permission: "analytics.view" },
  { name: "Permissions", href: "/permissions", icon: Lock, permission: "permissions.manage" },
  { name: "Admin", href: "/admin", icon: ShieldCheck, permission: "admin.manage" },
  { name: "Notifications", href: "/notifications", icon: Bell, permission: null },
  { name: "Chat", href: "/chat", icon: MessageCircle, permission: null },
  { name: "Settings", href: "/settings", icon: Settings, permission: null },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDealer, dealerBranchName } = useDealerBranch();
  const { hasPermission } = usePermissions();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Filter navigation based on permissions
  const visibleNav = navigation.filter(item => {
    // Items with no permission are always visible
    if (!item.permission) return true;
    // Admin sees everything
    if (user?.role === "admin") return true;
    // Check permission
    return hasPermission(item.permission);
  });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex h-20 items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Fuel className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-sidebar-foreground">FMS</span>
              <span className="text-xs text-sidebar-foreground/60">
                {isDealer && dealerBranchName ? dealerBranchName : "Forecourt Management"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors hidden lg:block"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {isDealer && dealerBranchName && !collapsed && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <Badge variant="outline" className="w-full justify-center text-xs bg-primary/10 text-primary border-primary/30">
            {dealerBranchName}
          </Badge>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  className={cn("nav-item", isActive && "nav-item-active")}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground font-semibold text-sm">
            {user?.profile?.full_name ? getInitials(user.profile.full_name) : "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.profile?.full_name || "User"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">
                {user?.role || "No role"}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

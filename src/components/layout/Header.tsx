import { Bell, Calendar, MapPin, Fuel, ArrowRight, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useDealerBranch, useShiftSelect } from "@/hooks/useDealerBranch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDismissedNotifications } from "@/hooks/useDismissedNotifications";
import { useEffect } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const { isDealer, dealerBranchId, dealerBranchName } = useDealerBranch();
  const { shifts, selectedShift, setSelectedShift } = useShiftSelect();
  const queryClient = useQueryClient();
  const { dismissedKeys, dismiss } = useDismissedNotifications();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const { data: branches } = useQuery({
    queryKey: ["header-branches"],
    enabled: !isDealer,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tankAlerts } = useQuery({
    queryKey: ["header-tank-alerts", dealerBranchId],
    queryFn: async () => {
      let q = supabase
        .from("tanks")
        .select("id, name, product_type, current_level_usg, capacity_usg, branches(name)")
        .eq("is_active", true);
      if (isDealer && dealerBranchId) q = q.eq("branch_id", dealerBranchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])
        .map(t => ({ ...t, pct: (Number(t.current_level_usg) / Number(t.capacity_usg)) * 100 }))
        .filter(t => t.pct < 30)
        .sort((a, b) => a.pct - b.pct);
    },
    refetchInterval: 30000,
  });

  // Real-time tank updates so the bell badge reflects changes instantly
  useEffect(() => {
    const channel = supabase
      .channel("header-tanks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tanks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["header-tank-alerts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Hide alerts the user has already dismissed on the Notifications page
  const visibleAlerts = (tankAlerts ?? []).filter((t) => {
    const key = t.pct < 20 ? `tank-crit-${t.id}` : `tank-low-${t.id}`;
    return !dismissedKeys.has(key);
  });
  const alertCount = visibleAlerts.length;

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
              <Fuel className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Dealer branch label */}
          {isDealer && dealerBranchName && (
            <Badge variant="outline" className="hidden sm:flex bg-primary/10 text-primary border-primary/30 text-xs">
              <MapPin className="h-3 w-3 mr-1" /> {dealerBranchName}
            </Badge>
          )}

          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{today}</span>
          </div>

          {/* Branch selector - hidden for dealers */}
          {!isDealer && (
            <Select defaultValue="all">
              <SelectTrigger className="w-28 sm:w-40 bg-card hidden sm:flex h-8 sm:h-9 text-xs sm:text-sm">
                <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Shift selector - All Day default */}
          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className="w-24 sm:w-36 bg-card h-8 sm:h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              {shifts?.map((shift) => (
                <SelectItem key={shift.id} value={shift.id}>
                  <span className="font-medium">{shift.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">({shift.start_time}–{shift.end_time})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="bg-card relative h-8 w-8 sm:h-9 sm:w-9">
                <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                    {alertCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 sm:w-80 p-0" align="end">
              <div className="p-3 border-b border-border">
                <h4 className="font-semibold text-sm">Notifications</h4>
                <p className="text-xs text-muted-foreground">{alertCount} active alert{alertCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {alertCount === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">All systems normal ✓</div>
                ) : (
                  tankAlerts?.map(t => (
                    <div key={t.id} className="flex items-start gap-3 p-3 border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", t.pct < 20 ? "bg-destructive animate-pulse" : "bg-warning")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{(t.branches as any)?.name} · {t.product_type} · {t.pct.toFixed(0)}%</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", t.pct < 20 ? "border-destructive text-destructive" : "border-warning text-warning")}>
                        {t.pct < 20 ? "CRIT" : "LOW"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border p-2">
                <Link to="/notifications" className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline py-1.5">
                  View all notifications <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}

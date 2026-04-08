import { Bell, Search, Calendar, MapPin, Fuel } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const { data: branches } = useQuery({
    queryKey: ["header-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: shifts } = useQuery({
    queryKey: ["header-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: tankAlerts } = useQuery({
    queryKey: ["header-tank-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanks")
        .select("id, name, product_type, current_level_usg, capacity_usg, branches(name)")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? [])
        .map(t => ({ ...t, pct: (Number(t.current_level_usg) / Number(t.capacity_usg)) * 100 }))
        .filter(t => t.pct < 30)
        .sort((a, b) => a.pct - b.pct);
    },
    refetchInterval: 30000,
  });

  const alertCount = tankAlerts?.length ?? 0;

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo & Name - visible on mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
              <Fuel className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground hidden sm:inline">FMS</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{today}</span>
          </div>

          <Select defaultValue="all">
            <SelectTrigger className="w-32 sm:w-44 bg-card hidden sm:flex">
              <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select defaultValue={shifts?.[0]?.id || "morning"}>
            <SelectTrigger className="w-28 sm:w-40 bg-card hidden sm:flex">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              {shifts?.map((shift) => (
                <SelectItem key={shift.id} value={shift.id}>
                  <span className="font-medium">{shift.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">({shift.start_time}–{shift.end_time})</span>
                </SelectItem>
              )) || (
                <>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="bg-card relative">
                <Bell className="h-4 w-4" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                    {alertCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b border-border">
                <h4 className="font-semibold text-sm">Notifications</h4>
                <p className="text-xs text-muted-foreground">{alertCount} active alert{alertCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {alertCount === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    All systems normal ✓
                  </div>
                ) : (
                  tankAlerts?.map(t => (
                    <div key={t.id} className="flex items-start gap-3 p-3 border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <div className={cn(
                        "h-2 w-2 rounded-full mt-1.5 shrink-0",
                        t.pct < 20 ? "bg-destructive animate-pulse" : "bg-warning"
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(t.branches as any)?.name} · {t.product_type} · {t.pct.toFixed(0)}%
                        </p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px] shrink-0",
                        t.pct < 20 ? "border-destructive text-destructive" : "border-warning text-warning"
                      )}>
                        {t.pct < 20 ? "CRIT" : "LOW"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}

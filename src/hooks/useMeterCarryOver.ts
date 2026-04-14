import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the closing meter for a given pump from the previous shift on the same date,
 * or the last entry's closing meter if no prior shift today.
 * This implements the carry-over rule: closing meter of AM = opening meter of Afternoon, etc.
 */
export function useMeterCarryOver(pumpId: string, date: string, branchId: string, shiftId: string) {
  return useQuery({
    queryKey: ["meter-carry-over", pumpId, date, branchId, shiftId],
    enabled: !!pumpId && !!date && !!branchId && !!shiftId,
    queryFn: async () => {
      // Get shifts ordered by start_time to determine shift sequence
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, name, start_time")
        .order("start_time");

      if (!shifts || shifts.length === 0) return null;

      const currentShiftIdx = shifts.findIndex(s => s.id === shiftId);
      
      // Look for the previous shift's closing meter
      // 1. Same day, previous shift
      if (currentShiftIdx > 0) {
        const prevShift = shifts[currentShiftIdx - 1];
        const { data } = await supabase
          .from("shift_sales_reports")
          .select("closing_meter")
          .eq("pump_id", pumpId)
          .eq("date", date)
          .eq("shift_id", prevShift.id)
          .eq("branch_id", branchId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return Number(data.closing_meter);
      }

      // 2. If it's the first shift of the day, get last shift of previous day
      const { data: lastEntry } = await supabase
        .from("shift_sales_reports")
        .select("closing_meter")
        .eq("pump_id", pumpId)
        .eq("branch_id", branchId)
        .lt("date", date)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return lastEntry ? Number(lastEntry.closing_meter) : null;
    },
  });
}

/**
 * Same carry-over logic but for tank dips (stock_readings)
 */
export function useDipCarryOver(tankId: string, date: string, branchId: string, shiftId: string) {
  return useQuery({
    queryKey: ["dip-carry-over", tankId, date, branchId, shiftId],
    enabled: !!tankId && !!date && !!branchId && !!shiftId,
    queryFn: async () => {
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, name, start_time")
        .order("start_time");

      if (!shifts || shifts.length === 0) return null;

      const currentShiftIdx = shifts.findIndex(s => s.id === shiftId);

      if (currentShiftIdx > 0) {
        const prevShift = shifts[currentShiftIdx - 1];
        const { data } = await supabase
          .from("stock_readings")
          .select("physical_level_usg")
          .eq("tank_id", tankId)
          .eq("date", date)
          .eq("shift_id", prevShift.id)
          .eq("branch_id", branchId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return Number(data.physical_level_usg);
      }

      const { data: lastEntry } = await supabase
        .from("stock_readings")
        .select("physical_level_usg")
        .eq("tank_id", tankId)
        .eq("branch_id", branchId)
        .lt("date", date)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return lastEntry ? Number(lastEntry.physical_level_usg) : null;
    },
  });
}

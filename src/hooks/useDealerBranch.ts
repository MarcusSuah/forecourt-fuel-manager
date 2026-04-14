import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function useDealerBranch() {
  const { user } = useAuth();
  const isDealer = user?.role === "dealer";

  const { data: dealerBranch } = useQuery({
    queryKey: ["dealer-branch", user?.id],
    enabled: isDealer && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendants")
        .select("branch_id, branches(id, name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    isDealer,
    dealerBranchId: dealerBranch?.branch_id || null,
    dealerBranchName: (dealerBranch?.branches as any)?.name || null,
  };
}

/**
 * Hook that auto-selects the dealer's branch and provides branch filter state.
 * For dealers: auto-selects their assigned branch and disables the selector.
 * For admins/supervisors: allows free selection with "all" as default.
 */
export function useBranchFilter(defaultValue: string = "all") {
  const { isDealer, dealerBranchId } = useDealerBranch();
  const [branchFilter, setBranchFilter] = useState(defaultValue);

  useEffect(() => {
    if (isDealer && dealerBranchId) {
      setBranchFilter(dealerBranchId);
    }
  }, [isDealer, dealerBranchId]);

  return {
    branchFilter,
    setBranchFilter: isDealer ? () => {} : setBranchFilter,
    isDealer,
    dealerBranchId,
    isBranchDisabled: isDealer,
  };
}

/**
 * Hook for forms where branch must be selected (not "all").
 * For dealers: auto-selects their branch.
 * For others: starts empty, user must select.
 */
export function useBranchSelect() {
  const { isDealer, dealerBranchId, dealerBranchName } = useDealerBranch();
  const [selectedBranch, setSelectedBranch] = useState("");

  useEffect(() => {
    if (isDealer && dealerBranchId) {
      setSelectedBranch(dealerBranchId);
    }
  }, [isDealer, dealerBranchId]);

  return {
    selectedBranch,
    setSelectedBranch: isDealer ? () => {} : setSelectedBranch,
    isDealer,
    dealerBranchId,
    dealerBranchName,
    isBranchDisabled: isDealer,
  };
}

/**
 * Hook for shift selection with "All Day" as default.
 */
export function useShiftSelect() {
  const [selectedShift, setSelectedShift] = useState("");

  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  // Auto-select "All Day" shift as default
  useEffect(() => {
    if (shifts && !selectedShift) {
      const allDay = shifts.find(s => s.name === "All Day");
      if (allDay) setSelectedShift(allDay.id);
    }
  }, [shifts, selectedShift]);

  return { shifts, selectedShift, setSelectedShift };
}

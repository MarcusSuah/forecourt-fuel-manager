import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

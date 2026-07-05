import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ZONE_OPTIONS = ["central", "north", "east", "west", "south"] as const;
export type Zone = typeof ZONE_OPTIONS[number];

export function useSupervisorZone() {
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor";

  const { data: zone } = useQuery({
    queryKey: ["supervisor-zone", user?.id],
    enabled: isSupervisor && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendants")
        .select("supervisor_zone")
        .eq("user_id", user!.id)
        .not("supervisor_zone", "is", null)
        .maybeSingle();
      if (error) throw error;
      return (data?.supervisor_zone as Zone | undefined) ?? null;
    },
  });

  const { data: zoneBranches } = useQuery({
    queryKey: ["supervisor-zone-branches", zone],
    enabled: isSupervisor && !!zone,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, county, location, is_active, zone")
        .eq("zone", zone as any)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return {
    isSupervisor,
    zone: zone ?? null,
    zoneBranches: zoneBranches ?? [],
    zoneBranchIds: (zoneBranches ?? []).map((b) => b.id),
  };
}
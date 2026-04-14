import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  const { data: permissions } = useQuery({
    queryKey: ["role-permissions", role],
    enabled: !!role,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions(name)")
        .eq("role", role!);
      if (error) throw error;
      return data?.map((rp) => (rp.permissions as any)?.name as string).filter(Boolean) ?? [];
    },
  });

  const hasPermission = (permName: string) => {
    if (role === "admin") return true;
    return permissions?.includes(permName) ?? false;
  };

  return { permissions: permissions ?? [], hasPermission };
}

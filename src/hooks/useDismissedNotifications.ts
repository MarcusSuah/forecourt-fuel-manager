import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useDismissedNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dismissedKeys = new Set<string>() } = useQuery({
    queryKey: ["dismissed-notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dismissed_notifications")
        .select("notification_key")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((d) => d.notification_key));
    },
  });

  // Realtime updates so badge clears across tabs
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`dismissed-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dismissed_notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["dismissed-notifications", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const dismiss = useMutation({
    mutationFn: async ({ key, type }: { key: string; type: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("dismissed_notifications")
        .insert({ user_id: user.id, notification_key: key, notification_type: type });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dismissed-notifications", user?.id] }),
  });

  const dismissMany = useMutation({
    mutationFn: async (items: Array<{ key: string; type: string }>) => {
      if (!user?.id || items.length === 0) return;
      const rows = items.map((i) => ({ user_id: user.id, notification_key: i.key, notification_type: i.type }));
      const { error } = await supabase
        .from("dismissed_notifications")
        .upsert(rows, { onConflict: "user_id,notification_key", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dismissed-notifications", user?.id] }),
  });

  const restoreAll = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("dismissed_notifications")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dismissed-notifications", user?.id] }),
  });

  return {
    dismissedKeys,
    isDismissed: (key: string) => dismissedKeys.has(key),
    dismiss: dismiss.mutate,
    dismissMany: dismissMany.mutate,
    restoreAll: restoreAll.mutate,
  };
}
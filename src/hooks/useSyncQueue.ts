import { useEffect, useState } from "react";
import {
  type QueueEntry,
  getEntries,
  subscribe,
  syncAll,
  retry,
  discard,
  isOffline,
} from "@/lib/sync-queue";

/**
 * React binding for the offline sync queue.
 * Re-renders whenever entries change or the browser flips online/offline.
 */
export function useSyncQueue() {
  const [entries, setEntries] = useState<QueueEntry[]>(() => getEntries());
  const [offline, setOffline] = useState<boolean>(() => isOffline());

  useEffect(() => subscribe(setEntries), []);

  useEffect(() => {
    const onOnline = () => { setOffline(false); void syncAll(); };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const pending = entries.filter((e) => e.status === "pending" || e.status === "syncing");
  const failed = entries.filter((e) => e.status === "failed");

  return {
    entries,
    pending,
    failed,
    offline,
    total: entries.length,
    syncNow: syncAll,
    retry,
    discard,
  };
}
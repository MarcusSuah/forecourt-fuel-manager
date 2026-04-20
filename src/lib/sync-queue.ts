import { supabase } from "@/integrations/supabase/client";

/**
 * Offline-first insert queue.
 * Records to insert are stored in localStorage and flushed when online.
 * Each entry retries up to MAX_RETRIES times; on the 3rd failure it moves to
 * the "failed" state and the user must Retry or Discard manually.
 *
 * Each entry is also mirrored to a shared `sync_queue` table in the database
 * (best-effort) so that admins can monitor and act on queued entries from
 * every user via the /admin/sync-queue page.
 */

export type QueueEntryStatus = "pending" | "syncing" | "failed";

export type QueueTable = "shift_sales_reports" | "cash_deposits";

export interface QueueEntry {
  id: string;
  table: QueueTable;
  /** One or many rows to insert in a single .insert() call. */
  rows: Record<string, any>[];
  /** Friendly label shown in the popover (e.g. "Sales: 3 pumps · Branch X"). */
  label: string;
  status: QueueEntryStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "fms.sync-queue.v1";
const MAX_RETRIES = 3;

type Listener = (entries: QueueEntry[]) => void;
const listeners = new Set<Listener>();

function read(): QueueEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: QueueEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error("[sync-queue] Failed to persist:", err);
  }
  listeners.forEach((l) => l(entries));
}

export function getEntries(): QueueEntry[] {
  return read();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Push current state immediately so subscribers don't see a stale empty list
  listener(read());
  return () => {
    listeners.delete(listener);
  };
}

function uid(): string {
  return (crypto?.randomUUID?.() ?? `q_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}

/**
 * Enqueue an insert. Returns the generated entry id.
 * Caller decides when to call this — typically when supabase.insert() throws
 * a network/offline error, or unconditionally if you want write-behind.
 */
export function enqueue(input: {
  table: QueueTable;
  rows: Record<string, any>[];
  label: string;
}): string {
  const entries = read();
  const entry: QueueEntry = {
    id: uid(),
    table: input.table,
    rows: input.rows,
    label: input.label,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  write([...entries, entry]);
  // Mirror to shared table for admin visibility (best-effort, non-blocking)
  void mirrorToServer(entry);
  // Try to flush right away in case we're actually online
  void syncAll();
  return entry.id;
}

export function discard(id: string) {
  void deleteMirror(id);
  write(read().filter((e) => e.id !== id));
}

export function discardAll() {
  const all = read();
  for (const e of all) void deleteMirror(e.id);
  write([]);
}

/** Reset a failed entry back to pending so the next sync attempts it again. */
export function retry(id: string) {
  const entries = read().map((e) =>
    e.id === id ? { ...e, status: "pending" as const, attempts: 0, lastError: undefined, updatedAt: Date.now() } : e,
  );
  write(entries);
  void updateMirror(id, { status: "pending", attempts: 0, last_error: null });
  void syncAll();
}

let syncInFlight = false;

/**
 * Attempt to flush every pending entry. Safe to call repeatedly — concurrent
 * calls are coalesced.
 */
export async function syncAll(): Promise<void> {
  if (syncInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  syncInFlight = true;
  try {
    // Snapshot pending ids; we re-read between iterations so mutations
    // (other tabs, manual retries) are picked up.
    const pendingIds = read().filter((e) => e.status === "pending").map((e) => e.id);
    for (const id of pendingIds) {
      await flushOne(id);
    }
  } finally {
    syncInFlight = false;
  }
}

async function flushOne(id: string): Promise<void> {
  // Mark syncing
  let entries = read();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  if (entries[idx].status !== "pending") return;

  entries[idx] = { ...entries[idx], status: "syncing", updatedAt: Date.now() };
  write(entries);

  const entry = entries[idx];
  try {
    const { error } = await supabase.from(entry.table).insert(entry.rows as any);
    if (error) throw error;
    // Success — remove from queue
    write(read().filter((e) => e.id !== id));
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const current = read();
    const i = current.findIndex((e) => e.id === id);
    if (i === -1) return;
    const attempts = current[i].attempts + 1;
    const status: QueueEntryStatus = attempts >= MAX_RETRIES ? "failed" : "pending";
    current[i] = {
      ...current[i],
      status,
      attempts,
      lastError: message,
      updatedAt: Date.now(),
    };
    write(current);
  }
}

let listenersInstalled = false;

/** Install global online/visibility listeners so the queue auto-flushes. */
export function installSyncListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  if (typeof window === "undefined") return;

  const trigger = () => { void syncAll(); };

  window.addEventListener("online", trigger);
  window.addEventListener("focus", trigger);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger();
  });

  // Periodic retry for transient errors (every 60s)
  setInterval(trigger, 60_000);

  // Try once on startup in case we're already online with backlog
  trigger();
}

/** True when navigator reports offline — useful for UI hints. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export const SYNC_QUEUE_MAX_RETRIES = MAX_RETRIES;
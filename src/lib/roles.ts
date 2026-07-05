import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLES = {
  admin: "admin",
  supervisor: "supervisor",
  dealer: "dealer",
  cashier: "cashier",
  attendant: "attendant",
} as const satisfies Record<AppRole, AppRole>;

export const ALL_ROLES: readonly AppRole[] = [
  ROLES.admin,
  ROLES.supervisor,
  ROLES.dealer,
  ROLES.cashier,
  ROLES.attendant,
];

export const isAdmin = (role?: AppRole | null): boolean => role === ROLES.admin;
export const isSupervisor = (role?: AppRole | null): boolean => role === ROLES.supervisor;
export const isDealer = (role?: AppRole | null): boolean => role === ROLES.dealer;

/** Roles that can edit branch-scoped operational data (subject to branch scope). */
export const WRITE_ROLES: readonly AppRole[] = [
  ROLES.admin,
  ROLES.dealer,
  ROLES.cashier,
  ROLES.attendant,
];

export const canWrite = (role?: AppRole | null): boolean =>
  !!role && WRITE_ROLES.includes(role);

/** Supervisors are read-only across their zone. */
export const isReadOnly = (role?: AppRole | null): boolean =>
  role === ROLES.supervisor;
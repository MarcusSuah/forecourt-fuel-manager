import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerBranch } from "./useDealerBranch";
import { useSupervisorZone } from "./useSupervisorZone";
import { canWrite as roleCanWrite, isReadOnly, ROLES, type AppRole } from "@/lib/roles";

/**
 * Unified access scope for the current user.
 *
 * - admin: sees everything, can write everywhere
 * - dealer: scoped to their branch, can write in that branch
 * - supervisor: scoped to their zone's branches, READ-ONLY
 * - cashier/attendant: scoped to their branch, can write
 *
 * Use this instead of re-implementing branch/zone/role checks per page.
 */
export function useAccessScope() {
  const { user } = useAuth();
  const role = user?.role as AppRole | undefined;

  const { dealerBranchId } = useDealerBranch();
  const { zone, zoneBranchIds } = useSupervisorZone();

  return useMemo(() => {
    const isAdmin = role === ROLES.admin;
    const isDealer = role === ROLES.dealer;
    const isSupervisor = role === ROLES.supervisor;

    // undefined = all branches (admin); [] = no access; [ids] = restricted.
    let allowedBranchIds: string[] | undefined;
    let defaultBranchId: string | null = null;

    if (isAdmin) {
      allowedBranchIds = undefined;
    } else if (isDealer) {
      allowedBranchIds = dealerBranchId ? [dealerBranchId] : [];
      defaultBranchId = dealerBranchId ?? null;
    } else if (isSupervisor) {
      allowedBranchIds = zoneBranchIds;
    } else {
      // cashier / attendant: treat like dealer if they have a branch assignment
      allowedBranchIds = dealerBranchId ? [dealerBranchId] : [];
      defaultBranchId = dealerBranchId ?? null;
    }

    const canWriteBranch = (branchId?: string | null): boolean => {
      if (isReadOnly(role)) return false;
      if (!roleCanWrite(role)) return false;
      if (isAdmin) return true;
      if (!branchId) return false;
      return allowedBranchIds?.includes(branchId) ?? false;
    };

    return {
      role,
      isAdmin,
      isDealer,
      isSupervisor,
      readOnly: isReadOnly(role),
      zone,
      allowedBranchIds,
      defaultBranchId,
      /** True if the user may write to at least one branch. */
      canWriteAny: roleCanWrite(role),
      /** True if the user may write to a specific branch. */
      canWriteBranch,
    };
  }, [role, dealerBranchId, zone, zoneBranchIds]);
}
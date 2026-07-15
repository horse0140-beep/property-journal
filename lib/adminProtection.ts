import {
  isFounderAccount,
  PROTECTED_ACCOUNT_MESSAGE,
  SUPER_ADMIN_ROLE,
} from "@/lib/admin";
import type { PlanKey, UserRole } from "@/types/admin";

export { PROTECTED_ACCOUNT_MESSAGE };

export type AdminGuardAction =
  | "delete"
  | "revoke"
  | "revoke_role"
  | "revoke_entitlement"
  | "downgrade_plan"
  | "downgrade_role"
  | "modify";

export function assertFounderProtected(targetEmail?: string | null): void {
  if (isFounderAccount(targetEmail)) {
    throw new Error(PROTECTED_ACCOUNT_MESSAGE);
  }
}

/** Block admin mutations that would downgrade or remove founder access. */
export function assertFounderImmutable(params: {
  targetEmail?: string | null;
  nextRole?: UserRole;
  nextPlan?: PlanKey;
}): void {
  const { targetEmail, nextRole, nextPlan } = params;
  if (!isFounderAccount(targetEmail)) return;

  if (nextPlan === "free") {
    throw new Error(PROTECTED_ACCOUNT_MESSAGE);
  }
  if (nextRole != null && nextRole !== SUPER_ADMIN_ROLE) {
    throw new Error(PROTECTED_ACCOUNT_MESSAGE);
  }
}

export function assertSelfAdminSafety(params: {
  actorId?: string | null;
  targetId: string;
  targetEmail?: string | null;
  action: AdminGuardAction;
  nextRole?: UserRole;
  nextPlan?: PlanKey;
  currentRole?: UserRole | null;
}): void {
  const { actorId, targetId, targetEmail, action, nextRole, nextPlan, currentRole } = params;

  assertFounderProtected(targetEmail);

  if (!actorId || actorId !== targetId) return;

  if (action === "delete") {
    throw new Error("You cannot delete your own account from admin.");
  }
  if (action === "revoke" || action === "revoke_role" || action === "revoke_entitlement") {
    throw new Error("You cannot revoke your own access.");
  }
  if (action === "downgrade_plan" || (action === "modify" && nextPlan === "free")) {
    if (isFounderAccount(targetEmail)) {
      throw new Error(PROTECTED_ACCOUNT_MESSAGE);
    }
    if (actorId === targetId && currentRole === SUPER_ADMIN_ROLE) {
      throw new Error("You cannot downgrade your own plan while you have super admin access.");
    }
  }
  if (
    action === "downgrade_role" ||
    (action === "modify" && nextRole != null && nextRole !== SUPER_ADMIN_ROLE)
  ) {
    if (actorId === targetId && currentRole === SUPER_ADMIN_ROLE) {
      throw new Error("You cannot remove your own super admin role.");
    }
  }
}

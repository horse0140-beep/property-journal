/** App owner — always has full premium + super_admin access. */
export const OWNER_ADMIN_EMAIL = "hdmccoy180@gmail.com";

/** Admin role stored in user_roles.role (not profiles). */
export const SUPER_ADMIN_ROLE = "super_admin";

export const OWNER_ADMIN_BADGE = "SUPER ADMIN";

export function isOwnerAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === OWNER_ADMIN_EMAIL.toLowerCase();
}

/** True when user_roles.role is super_admin. */
export function isSuperAdminRole(role?: string | null): boolean {
  return role === SUPER_ADMIN_ROLE;
}

/**
 * Admin access: owner email OR user_roles.role === super_admin.
 * profiles.plan is subscription tier only — never used for admin.
 */
export function resolveIsAdmin(email?: string | null, userRoleFromUserRoles?: string | null): boolean {
  if (isOwnerAdminEmail(email)) return true;
  return isSuperAdminRole(userRoleFromUserRoles);
}

/** Owner email or resolved admin — unlocks all premium/landlord/realtor features. */
export function hasUnrestrictedAccess(email?: string | null, isAdmin = false): boolean {
  if (isOwnerAdminEmail(email)) return true;
  return isAdmin;
}

export function adminPlanBadge(email?: string | null): string {
  return isOwnerAdminEmail(email) ? "Owner Access" : "Super Admin";
}

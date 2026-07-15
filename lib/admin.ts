/** Primary founder account — immutable owner + super_admin. */
export const FOUNDER_EMAIL = "horse0140@gmail.com";

/** Legacy co-founder — same permanent protections as FOUNDER_EMAIL. */
export const LEGACY_FOUNDER_EMAIL = "hdmccoy180@gmail.com";

/** All emails with permanent owner / super-admin protection. */
export const PROTECTED_FOUNDER_EMAILS = [
  FOUNDER_EMAIL,
  LEGACY_FOUNDER_EMAIL,
] as const;

/** @deprecated Use FOUNDER_EMAIL */
export const OWNER_ADMIN_EMAIL = FOUNDER_EMAIL;

/** Admin role stored in user_roles.role (not profiles). */
export const SUPER_ADMIN_ROLE = "super_admin";

/** Founder always retains top-tier plan + all entitlements. */
export const FOUNDER_PLAN = "realtor" as const;

export const FOUNDER_ENTITLEMENTS = [
  "owner_access",
  "premium",
  "landlord",
  "realtor",
] as const;

export type FounderEntitlement = (typeof FOUNDER_ENTITLEMENTS)[number];

export const OWNER_ADMIN_BADGE = "SUPER ADMIN";

export const FOUNDER_ACCOUNT_LABEL = "FOUNDER ACCOUNT";
export const OWNER_ACCESS_LABEL = "OWNER ACCESS";
export const SUPER_ADMIN_LABEL = "SUPER ADMIN";

export const PROTECTED_ACCOUNT_MESSAGE =
  "This account is protected and cannot be modified.";

export function normalizeAdminEmail(email?: string | null): string {
  return (email ?? "").toLowerCase().trim();
}

export function isFounderAccount(email?: string | null): boolean {
  if (!email) return false;
  const normalized = normalizeAdminEmail(email);
  return PROTECTED_FOUNDER_EMAILS.some((e) => normalizeAdminEmail(e) === normalized);
}

/** @deprecated Use isFounderAccount */
export const isOwnerAdminEmail = isFounderAccount;

/** True when user_roles.role is super_admin. */
export function isSuperAdminRole(role?: string | null): boolean {
  return role === SUPER_ADMIN_ROLE;
}

/**
 * Admin access: founder email OR user_roles.role === super_admin.
 * profiles.plan is subscription tier only — never used for admin.
 */
export function resolveIsAdmin(email?: string | null, userRoleFromUserRoles?: string | null): boolean {
  if (isFounderAccount(email)) return true;
  return isSuperAdminRole(userRoleFromUserRoles);
}

/** Founder email or resolved admin — unlocks all premium/landlord/realtor features. */
export function hasUnrestrictedAccess(email?: string | null, isAdmin = false): boolean {
  if (isFounderAccount(email)) return true;
  return isAdmin;
}

export function adminPlanBadge(email?: string | null): string {
  return isFounderAccount(email) ? OWNER_ACCESS_LABEL : SUPER_ADMIN_LABEL;
}

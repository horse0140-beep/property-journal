import { supabase } from "@/lib/supabase";
import { upsertUserEntitlement } from "@/lib/entitlementWrite";
import {
  isFounderAccount,
  FOUNDER_EMAIL,
  LEGACY_FOUNDER_EMAIL,
  PROTECTED_FOUNDER_EMAILS,
  OWNER_ADMIN_EMAIL,
  SUPER_ADMIN_ROLE,
  FOUNDER_PLAN,
  FOUNDER_ENTITLEMENTS,
  PROTECTED_ACCOUNT_MESSAGE,
} from "@/lib/admin";
import { assertFounderProtected, assertFounderImmutable, assertSelfAdminSafety } from "@/lib/adminProtection";
import { logAdminAction } from "@/services/adminAuditService";
import type {
  AdminDashboardStats,
  AdminStats,
  AdminUser,
  EntitlementKey,
  PlanKey,
  PricingOverview,
  PricingPlan,
  PricingPlanInput,
  PromoCode,
  PromoCodeInput,
  UserRole,
} from "@/types/admin";

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("42p01") ||
    lower.includes("could not find the table")
  );
}

// ── Owner bootstrap ─────────────────────────────────────────────

export async function ensureOwnerAdminRole(userId: string, email: string): Promise<void> {
  if (!isFounderAccount(email)) return;

  const { error: rpcError } = await supabase.rpc("bootstrap_owner_admin");

  if (!rpcError) return;

  console.warn("bootstrap_owner_admin:", rpcError.message);

  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: SUPER_ADMIN_ROLE }, { onConflict: "user_id" });

  if (error) {
    console.warn("ensureOwnerAdminRole:", error.message);
  }

  for (const entitlement of FOUNDER_ENTITLEMENTS) {
    await grantEntitlement(userId, entitlement, userId).catch(() => {});
  }

  const { error: planError } = await supabase
    .from("profiles")
    .update({ plan: FOUNDER_PLAN })
    .eq("id", userId);

  if (planError) {
    console.warn("ensureOwnerAdminRole plan:", planError.message);
  }
}

// ── Dashboard stats ─────────────────────────────────────────────

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const usersByPlan: Record<PlanKey, number> = {
    free: 0,
    premium: 0,
    landlord: 0,
    realtor: 0,
  };

  let totalUsers = 0;
  let ownerAccessUsers = 0;

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, plan");

  if (profileError && !isMissingTableError(profileError.message)) {
    throw new Error(profileError.message);
  }

  for (const row of profiles ?? []) {
    totalUsers++;
    const plan = (row.plan ?? "free") as PlanKey;
    if (plan in usersByPlan) usersByPlan[plan]++;
    if (isFounderAccount(row.email)) ownerAccessUsers++;
  }

  let entitlements: { user_id: string; entitlement: string }[] = [];
  const { data: entData, error: entError } = await supabase
    .from("user_entitlements")
    .select("user_id, entitlement");

  if (!entError) {
    entitlements = entData ?? [];
    const ownerEntitlementUsers = new Set(
      entitlements.filter((e) => e.entitlement === "owner_access").map((e) => e.user_id)
    );
    ownerAccessUsers = Math.max(ownerAccessUsers, ownerEntitlementUsers.size);
  }

  let roles: { user_id: string; role: string }[] = [];
  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id, role");

  if (!roleError) {
    roles = roleData ?? [];
    const superAdminIds = new Set(
      roles.filter((r) => r.role === SUPER_ADMIN_ROLE).map((r) => r.user_id)
    );
    ownerAccessUsers = Math.max(ownerAccessUsers, superAdminIds.size);
  }

  let activePromoCodes = 0;
  let totalPromoCodes = 0;
  const { data: promos, error: promoError } = await supabase
    .from("promo_codes")
    .select("id, is_active");

  if (!promoError) {
    totalPromoCodes = promos?.length ?? 0;
    activePromoCodes = (promos ?? []).filter((p) => p.is_active).length;
  }

  let activeSubscriptions = 0;
  let totalRevenue = 0;
  const { data: subs, error: subError } = await supabase
    .from("subscriptions")
    .select("amount, status");

  if (!subError) {
    const active = (subs ?? []).filter((s) => s.status === "active");
    activeSubscriptions = active.length;
    totalRevenue = active.reduce((sum, s) => sum + Number(s.amount ?? 0), 0);
  }

  let openTickets = 0;
  const { count: ticketCount, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  if (!ticketError) openTickets = ticketCount ?? 0;

  let pricingOverview: PricingOverview[] = [];
  try {
    const plans = await getPricingPlans();
    pricingOverview = plans.map((p) => ({
      plan_key: p.plan_key,
      name: p.name,
      monthly_price: Number(p.monthly_price),
      yearly_price: Number(p.yearly_price),
      is_active: p.is_active,
    }));
  } catch {
    pricingOverview = [];
  }

  return {
    totalUsers,
    freeUsers: usersByPlan.free,
    premiumUsers: usersByPlan.premium,
    landlordUsers: usersByPlan.landlord,
    realtorUsers: usersByPlan.realtor,
    ownerAccessUsers,
    activePromoCodes,
    totalPromoCodes,
    activeSubscriptions,
    openTickets,
    totalRevenue,
    usersByPlan,
    pricingOverview,
  };
}

/** @deprecated Use getAdminDashboardStats */
export async function fetchAdminStats(): Promise<AdminStats> {
  const stats = await getAdminDashboardStats();
  return {
    totalUsers: stats.totalUsers,
    activeSubscriptions: stats.activeSubscriptions,
    openTickets: stats.openTickets,
    activePromoCodes: stats.activePromoCodes,
    totalRevenue: stats.totalRevenue,
    usersByPlan: stats.usersByPlan,
  };
}

// ── Pricing ─────────────────────────────────────────────────────

export async function getPricingPlans(): Promise<PricingPlan[]> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingTableError(error.message)) {
      throw new Error(
        "pricing_plans table not found. Run migration 001_admin_tables.sql in Supabase."
      );
    }
    throw new Error(error.message);
  }

  return (data ?? []) as PricingPlan[];
}

export async function createPricingPlan(input: PricingPlanInput): Promise<PricingPlan> {
  const { data, error } = await supabase.from("pricing_plans").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as PricingPlan;
}

export async function updatePricingPlan(
  id: string,
  input: Partial<PricingPlanInput>
): Promise<PricingPlan> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PricingPlan;
}

export async function deletePricingPlan(id: string): Promise<void> {
  const { error } = await supabase.from("pricing_plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Promo codes ─────────────────────────────────────────────────

export async function getPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message)) {
      throw new Error(
        "promo_codes table not found. Run migration 001_admin_tables.sql in Supabase."
      );
    }
    throw new Error(error.message);
  }

  return (data ?? []) as PromoCode[];
}

export async function createPromoCode(input: PromoCodeInput): Promise<PromoCode> {
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({ ...input, code: input.code.toUpperCase().trim() })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PromoCode;
}

export async function updatePromoCode(id: string, input: Partial<PromoCodeInput>): Promise<PromoCode> {
  const payload = { ...input };
  if (payload.code) payload.code = payload.code.toUpperCase().trim();

  const { data, error } = await supabase
    .from("promo_codes")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PromoCode;
}

export async function deletePromoCode(id: string): Promise<void> {
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function disablePromoCode(id: string): Promise<void> {
  await updatePromoCode(id, { is_active: false });
}

// ── Users ───────────────────────────────────────────────────────

async function fetchUserEntitlements(): Promise<Map<string, EntitlementKey[]>> {
  const map = new Map<string, EntitlementKey[]>();
  const { data, error } = await supabase.from("user_entitlements").select("user_id, entitlement");

  if (error) {
    if (!isMissingTableError(error.message)) {
      console.warn("fetchUserEntitlements:", error.message);
    }
    return map;
  }

  for (const row of data ?? []) {
    const list = map.get(row.user_id) ?? [];
    list.push(row.entitlement as EntitlementKey);
    map.set(row.user_id, list);
  }

  return map;
}

async function getActorId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function getUsers(): Promise<AdminUser[]> {
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, phone, plan, created_at")
    .order("created_at", { ascending: false });

  if (profileError) throw new Error(profileError.message);

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("id, user_id, role");

  if (roleError && !isMissingTableError(roleError.message)) {
    throw new Error(roleError.message);
  }

  const roleMap = new Map(
    (roles ?? []).map((r) => [r.user_id, { role: r.role as UserRole, role_id: r.id }])
  );

  const entitlementMap = await fetchUserEntitlements();

  return (profiles ?? []).map((p) => {
    const roleEntry = roleMap.get(p.id);
    const founder = isFounderAccount(p.email);
    const entitlements = entitlementMap.get(p.id) ?? [];
    const hasOwnerAccess =
      founder || entitlements.includes("owner_access") || roleEntry?.role === SUPER_ADMIN_ROLE;

    return {
      id: p.id,
      email: p.email,
      name: p.name ?? "Property Journal User",
      phone: p.phone,
      plan: founder ? FOUNDER_PLAN : ((p.plan ?? "free") as PlanKey),
      created_at: p.created_at,
      role: founder ? SUPER_ADMIN_ROLE : (roleEntry?.role ?? null),
      role_id: roleEntry?.role_id ?? null,
      entitlements,
      has_owner_access: hasOwnerAccess,
      is_founder: founder,
    };
  });
}

/** @deprecated Use getUsers */
export const fetchAdminUsers = getUsers;

export async function updateUserPlan(
  userId: string,
  plan: PlanKey,
  targetEmail?: string,
  currentRole?: UserRole | null
): Promise<void> {
  const actorId = await getActorId();
  assertFounderImmutable({ targetEmail, nextPlan: plan });
  assertSelfAdminSafety({
    actorId,
    targetId: userId,
    targetEmail,
    action: plan === "free" ? "downgrade_plan" : "modify",
    nextPlan: plan,
    currentRole,
  });

  const { error } = await supabase.from("profiles").update({ plan }).eq("id", userId);
  if (error) throw new Error(error.message);

  if (targetEmail) {
    await logAdminAction({
      targetUserId: userId,
      targetEmail,
      action: "update_plan",
      metadata: { plan },
    });
  }
}

export async function grantUserRole(
  userId: string,
  role: UserRole,
  targetEmail?: string,
  currentRole?: UserRole | null
): Promise<void> {
  assertFounderImmutable({ targetEmail, nextRole: role });

  const actorId = await getActorId();
  if (currentRole === SUPER_ADMIN_ROLE && role !== SUPER_ADMIN_ROLE) {
    assertSelfAdminSafety({
      actorId,
      targetId: userId,
      targetEmail,
      action: "downgrade_role",
      nextRole: role,
      currentRole,
    });
  }

  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);

  if (targetEmail) {
    await logAdminAction({
      targetUserId: userId,
      targetEmail,
      action: "grant_role",
      metadata: { role },
    });
  }
}

export async function revokeUserRole(userId: string, targetEmail?: string): Promise<void> {
  const actorId = await getActorId();
  assertFounderProtected(targetEmail);
  assertSelfAdminSafety({
    actorId,
    targetId: userId,
    targetEmail,
    action: "revoke_role",
    currentRole: SUPER_ADMIN_ROLE,
  });

  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);

  if (targetEmail) {
    await logAdminAction({
      targetUserId: userId,
      targetEmail,
      action: "revoke_role",
    });
  }
}

/** @deprecated Use grantUserRole */
export const setUserRole = grantUserRole;

/** @deprecated Use revokeUserRole */
export const removeUserRole = revokeUserRole;

// ── Entitlements ────────────────────────────────────────────────

export async function grantEntitlement(
  userId: string,
  entitlement: EntitlementKey,
  grantedBy?: string
): Promise<void> {
  await upsertUserEntitlement(userId, entitlement, grantedBy);
}

export async function revokeEntitlement(
  userId: string,
  entitlement: EntitlementKey,
  targetEmail?: string
): Promise<void> {
  assertFounderProtected(targetEmail);

  const actorId = await getActorId();
  assertSelfAdminSafety({
    actorId,
    targetId: userId,
    targetEmail,
    action: "revoke_entitlement",
  });

  const { error } = await supabase
    .from("user_entitlements")
    .delete()
    .eq("user_id", userId)
    .eq("entitlement", entitlement);

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message);
  }

  if (targetEmail) {
    await logAdminAction({
      targetUserId: userId,
      targetEmail,
      action: "revoke_entitlement",
      metadata: { entitlement },
    });
  }
}

export async function revokeAllEntitlements(userId: string, targetEmail?: string): Promise<void> {
  assertFounderProtected(targetEmail);

  const actorId = await getActorId();
  assertSelfAdminSafety({
    actorId,
    targetId: userId,
    targetEmail,
    action: "revoke_entitlement",
  });

  if (isFounderAccount(targetEmail)) {
    throw new Error(PROTECTED_ACCOUNT_MESSAGE);
  }

  const { error } = await supabase.from("user_entitlements").delete().eq("user_id", userId);
  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message);
  }
}

export async function grantOwnerAccess(userId: string, email: string): Promise<void> {
  await grantUserRole(userId, SUPER_ADMIN_ROLE, email);
  await grantEntitlement(userId, "owner_access");
  if (!isFounderAccount(email)) {
    await updateUserPlan(userId, "realtor", email);
  }
  await logAdminAction({
    targetUserId: userId,
    targetEmail: email,
    action: "grant_owner",
  });
}

export async function grantPlanAccess(userId: string, plan: PlanKey, email?: string): Promise<void> {
  assertFounderImmutable({ targetEmail: email, nextPlan: plan });
  await updateUserPlan(userId, plan, email);
  if (plan !== "free") {
    await grantEntitlement(userId, plan);
  }
  if (email) {
    await logAdminAction({
      targetUserId: userId,
      targetEmail: email,
      action: "grant_plan",
      metadata: { plan },
    });
  }
}

export async function revokeAccess(userId: string, email: string): Promise<void> {
  if (isFounderAccount(email)) {
    await logAdminAction({
      targetUserId: userId,
      targetEmail: email,
      action: "revoke_blocked",
    });
    throw new Error(PROTECTED_ACCOUNT_MESSAGE);
  }

  const actorId = await getActorId();
  assertSelfAdminSafety({
    actorId,
    targetId: userId,
    targetEmail: email,
    action: "revoke",
  });

  await updateUserPlan(userId, "free", email);
  await revokeAllEntitlements(userId, email);
  await revokeUserRole(userId, email);

  await logAdminAction({
    targetUserId: userId,
    targetEmail: email,
    action: "revoke_access",
  });
}

export async function deleteUser(userId: string, email: string): Promise<void> {
  if (isFounderAccount(email)) {
    await logAdminAction({
      targetUserId: userId,
      targetEmail: email,
      action: "delete_user_blocked",
    });
    throw new Error(PROTECTED_ACCOUNT_MESSAGE);
  }

  const actorId = await getActorId();
  assertSelfAdminSafety({
    actorId,
    targetId: userId,
    targetEmail: email,
    action: "delete",
  });

  await revokeAllEntitlements(userId, email).catch(() => {});
  await revokeUserRole(userId, email).catch(() => {});

  const { error: subError } = await supabase.from("subscriptions").delete().eq("user_id", userId);
  if (subError && !isMissingTableError(subError.message)) {
    throw new Error(subError.message);
  }

  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw new Error(error.message);

  await logAdminAction({
    targetUserId: userId,
    targetEmail: email,
    action: "delete_user",
  });
}

export { FOUNDER_EMAIL, LEGACY_FOUNDER_EMAIL, PROTECTED_FOUNDER_EMAILS, OWNER_ADMIN_EMAIL };

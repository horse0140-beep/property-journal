import { supabase } from "@/lib/supabase";
import { isOwnerAdminEmail, OWNER_ADMIN_EMAIL, SUPER_ADMIN_ROLE } from "@/lib/admin";
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
  if (!isOwnerAdminEmail(email)) return;

  const { error: rpcError } = await supabase.rpc("bootstrap_owner_admin");

  if (!rpcError) return;

  console.warn("bootstrap_owner_admin:", rpcError.message);

  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: SUPER_ADMIN_ROLE }, { onConflict: "user_id" });

  if (error) {
    console.warn("ensureOwnerAdminRole:", error.message);
  }

  await grantEntitlement(userId, "owner_access").catch(() => {});
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
    if (isOwnerAdminEmail(row.email)) ownerAccessUsers++;
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
    const owner = isOwnerAdminEmail(p.email);
    const entitlements = entitlementMap.get(p.id) ?? [];
    const hasOwnerAccess =
      owner || entitlements.includes("owner_access") || roleEntry?.role === SUPER_ADMIN_ROLE;

    return {
      id: p.id,
      email: p.email,
      name: p.name ?? "HomeWise User",
      phone: p.phone,
      plan: (p.plan ?? "free") as PlanKey,
      created_at: p.created_at,
      role: owner ? SUPER_ADMIN_ROLE : (roleEntry?.role ?? null),
      role_id: roleEntry?.role_id ?? null,
      entitlements,
      has_owner_access: hasOwnerAccess,
    };
  });
}

/** @deprecated Use getUsers */
export const fetchAdminUsers = getUsers;

export async function updateUserPlan(userId: string, plan: PlanKey): Promise<void> {
  const { error } = await supabase.from("profiles").update({ plan }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function grantUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}

export async function revokeUserRole(userId: string): Promise<void> {
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
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
  const { error } = await supabase.from("user_entitlements").upsert(
    { user_id: userId, entitlement, granted_by: grantedBy ?? null },
    { onConflict: "user_id,entitlement" }
  );

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message);
  }
}

export async function revokeEntitlement(userId: string, entitlement: EntitlementKey): Promise<void> {
  const { error } = await supabase
    .from("user_entitlements")
    .delete()
    .eq("user_id", userId)
    .eq("entitlement", entitlement);

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message);
  }
}

export async function revokeAllEntitlements(userId: string): Promise<void> {
  const { error } = await supabase.from("user_entitlements").delete().eq("user_id", userId);
  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message);
  }
}

export async function grantOwnerAccess(userId: string, email: string): Promise<void> {
  await grantUserRole(userId, SUPER_ADMIN_ROLE);
  await grantEntitlement(userId, "owner_access");
  if (!isOwnerAdminEmail(email)) {
    await updateUserPlan(userId, "realtor");
  }
}

export async function grantPlanAccess(userId: string, plan: PlanKey): Promise<void> {
  await updateUserPlan(userId, plan);
  if (plan !== "free") {
    await grantEntitlement(userId, plan);
  }
}

export async function revokeAccess(userId: string, email: string): Promise<void> {
  if (isOwnerAdminEmail(email)) {
    throw new Error("Cannot revoke access for the app owner account.");
  }
  await updateUserPlan(userId, "free");
  await revokeAllEntitlements(userId);
  await revokeUserRole(userId);
}

export async function deleteUser(userId: string): Promise<void> {
  await revokeAllEntitlements(userId).catch(() => {});
  await revokeUserRole(userId).catch(() => {});

  const { error: subError } = await supabase.from("subscriptions").delete().eq("user_id", userId);
  if (subError && !isMissingTableError(subError.message)) {
    throw new Error(subError.message);
  }

  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw new Error(error.message);
}

export { OWNER_ADMIN_EMAIL };

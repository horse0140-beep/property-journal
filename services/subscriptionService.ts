import { supabase } from "@/lib/supabase";
import { getPricingPlans } from "@/services/adminService";
import { applyPromoDiscount } from "@/services/promoService";
import {
  configureRevenueCat,
  fetchRevenueCatState,
  isRevenueCatConfigured,
  type SubscriptionPackage,
} from "@/services/revenueCatService";
import type { BillingCycle, PlanKey, PromoCode, Subscription, SubscriptionStatus } from "@/types/admin";

// ── Subscription Center catalog ─────────────────────────────────

export const SUBSCRIPTION_PLAN_ORDER: PlanKey[] = ["free", "premium", "landlord", "realtor"];

export const PLAN_DISPLAY_NAMES: Record<PlanKey, string> = {
  free: "Free",
  premium: "Premium",
  landlord: "Landlord Pro",
  realtor: "Realtor Pro",
};

export const PLAN_COLORS: Record<PlanKey, string> = {
  free: "#8A9AB8",
  premium: "#1A3C8F",
  landlord: "#16A34A",
  realtor: "#F59E0B",
};

/** Feature highlights shown on each plan card in the Subscription Center. */
export const PLAN_FEATURE_LISTS: Record<PlanKey, string[]> = {
  free: ["1 property", "Basic health score", "Manual maintenance entries"],
  premium: [
    "Unlimited maintenance records",
    "Advanced reports",
    "Cloud backups",
  ],
  landlord: [
    "Multiple rental properties",
    "Tenant tools",
    "Lease tracking",
  ],
  realtor: [
    "Client property sharing",
    "Listing reports",
    "Export tools",
  ],
};

export type SubscriptionPlanInfo = {
  planKey: PlanKey;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  description?: string;
  isActive: boolean;
  sortOrder: number;
};

export type SubscriptionCenterData = {
  plans: SubscriptionPlanInfo[];
  revenueCatConfigured: boolean;
  revenueCatPackages: SubscriptionPackage[];
  activePlan: PlanKey;
};

const DEFAULT_PLANS: SubscriptionPlanInfo[] = [
  {
    planKey: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: PLAN_FEATURE_LISTS.free,
    description: "Get started with one property",
    isActive: true,
    sortOrder: 0,
  },
  {
    planKey: "premium",
    name: "Premium",
    monthlyPrice: 4.99,
    yearlyPrice: 39.99,
    features: PLAN_FEATURE_LISTS.premium,
    description: "Full homeowner protection",
    isActive: true,
    sortOrder: 1,
  },
  {
    planKey: "landlord",
    name: "Landlord Pro",
    monthlyPrice: 14.99,
    yearlyPrice: 149.99,
    features: PLAN_FEATURE_LISTS.landlord,
    description: "Manage multiple rentals",
    isActive: true,
    sortOrder: 2,
  },
  {
    planKey: "realtor",
    name: "Realtor Pro",
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    features: PLAN_FEATURE_LISTS.realtor,
    description: "Professional agent tools",
    isActive: true,
    sortOrder: 3,
  },
];

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("42p01")
  );
}

/** Load plan catalog from pricing_plans with safe fallbacks. */
export async function getSubscriptionPlans(): Promise<SubscriptionPlanInfo[]> {
  try {
    const rows = await getPricingPlans();
    if (!rows.length) return DEFAULT_PLANS;

    const mapped: SubscriptionPlanInfo[] = rows.map((row) => ({
      planKey: row.plan_key,
      name: row.name || PLAN_DISPLAY_NAMES[row.plan_key],
      monthlyPrice: Number(row.monthly_price),
      yearlyPrice: Number(row.yearly_price),
      features:
        row.features?.length > 0 ? row.features : PLAN_FEATURE_LISTS[row.plan_key],
      description: row.description ?? undefined,
      isActive: row.is_active,
      sortOrder: row.sort_order,
    }));

    const keys = new Set(mapped.map((p) => p.planKey));
    for (const fallback of DEFAULT_PLANS) {
      if (!keys.has(fallback.planKey)) mapped.push(fallback);
    }

    return mapped.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return DEFAULT_PLANS;
  }
}

/** Load plans + RevenueCat packages without throwing. */
export async function getSubscriptionCenterData(
  userPlan: PlanKey = "free",
  userId?: string
): Promise<SubscriptionCenterData> {
  const plans = await getSubscriptionPlans();
  const revenueCatConfigured = isRevenueCatConfigured();

  if (!revenueCatConfigured || !userId) {
    return {
      plans,
      revenueCatConfigured: false,
      revenueCatPackages: [],
      activePlan: userPlan,
    };
  }

  try {
    await configureRevenueCat(userId);
    const rc = await fetchRevenueCatState(userPlan);
    return {
      plans,
      revenueCatConfigured: rc.isConfigured,
      revenueCatPackages: rc.packages,
      activePlan: rc.activePlan,
    };
  } catch {
    return {
      plans,
      revenueCatConfigured: false,
      revenueCatPackages: [],
      activePlan: userPlan,
    };
  }
}

export function packagesForPlan(
  packages: SubscriptionPackage[],
  planKey: PlanKey
): SubscriptionPackage[] {
  return packages.filter((p) => p.plan === planKey);
}

export type DiscountedPrices = {
  monthly: number;
  yearly: number;
  hasDiscount: boolean;
};

/** Preview discounted prices for a plan after promo validation/redemption. */
export function getDiscountedPrices(
  plan: SubscriptionPlanInfo,
  promo: Pick<PromoCode, "discount_type" | "discount_value" | "plan_scope"> | null,
  selectedPlan: PlanKey
): DiscountedPrices {
  const monthly = plan.monthlyPrice;
  const yearly = plan.yearlyPrice;

  if (!promo || plan.planKey === "free") {
    return { monthly, yearly, hasDiscount: false };
  }

  const applies =
    promo.plan_scope === "all" || promo.plan_scope === plan.planKey;

  if (!applies) {
    return { monthly, yearly, hasDiscount: false };
  }

  const discountedMonthly = applyPromoDiscount(monthly, promo);
  const discountedYearly = applyPromoDiscount(yearly, promo);
  const hasDiscount = discountedMonthly < monthly || discountedYearly < yearly;

  return {
    monthly: discountedMonthly,
    yearly: discountedYearly,
    hasDiscount,
  };
}

export function planTierRank(plan: PlanKey): number {
  const order: PlanKey[] = ["free", "premium", "landlord", "realtor"];
  return order.indexOf(plan);
}

export function canUpgradeTo(current: PlanKey, target: PlanKey): boolean {
  return planTierRank(target) > planTierRank(current);
}

// ── Admin Supabase subscription CRUD (unchanged) ─────────────────

export type SubscriptionInput = {
  user_id: string;
  plan_key: PlanKey;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  amount: number;
  promo_code_id?: string | null;
  started_at?: string;
  expires_at?: string | null;
  cancelled_at?: string | null;
};

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw new Error(error.message);
  }

  const subs = (data ?? []) as Subscription[];
  if (subs.length === 0) return [];

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, name")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return subs.map((s) => {
    const profile = profileMap.get(s.user_id);
    return {
      ...s,
      user_email: profile?.email,
      user_name: profile?.name ?? undefined,
    };
  });
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("profiles").update({ plan: input.plan_key }).eq("id", input.user_id);

  return data as Subscription;
}

export async function updateSubscription(
  id: string,
  input: Partial<SubscriptionInput>
): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (input.plan_key && input.user_id) {
    await supabase.from("profiles").update({ plan: input.plan_key }).eq("id", input.user_id);
  } else if (input.plan_key && data?.user_id) {
    await supabase.from("profiles").update({ plan: input.plan_key }).eq("id", data.user_id);
  }

  return data as Subscription;
}

export async function deleteSubscription(id: string): Promise<void> {
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

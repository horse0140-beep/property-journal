import { supabase } from "@/lib/supabase";
import type { DiscountType, EntitlementKey, PlanKey, PromoCode } from "@/types/admin";

export type PromoCodeInput = {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  plan_scope: PlanKey | "all";
  max_uses?: number | null;
  is_active: boolean;
  expires_at?: string | null;
};

export type PromoValidationResult = {
  valid: boolean;
  error?: string;
  promo?: PromoCode;
};

export type PromoRedemptionResult = {
  success: boolean;
  error?: string;
  message?: string;
  promo?: PromoCode;
  grantedPlan?: PlanKey | null;
  discountedMonthly?: number;
  discountedYearly?: number;
};

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("42p01") ||
    lower.includes("could not find the table") ||
    lower.includes("could not find the function")
  );
}

function mapPromoRow(row: Record<string, unknown>): PromoCode {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    description: row.description != null ? String(row.description) : null,
    discount_type: row.discount_type as DiscountType,
    discount_value: Number(row.discount_value ?? 0),
    plan_scope: row.plan_scope as PlanKey | "all",
    max_uses: row.max_uses != null ? Number(row.max_uses) : null,
    used_count: Number(row.used_count ?? 0),
    is_active: Boolean(row.is_active ?? true),
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

/** Calculate discounted price from base price and promo. */
export function applyPromoDiscount(
  basePrice: number,
  promo: Pick<PromoCode, "discount_type" | "discount_value">
): number {
  if (basePrice <= 0) return 0;

  switch (promo.discount_type) {
    case "percent":
      return Math.max(0, basePrice * (1 - promo.discount_value / 100));
    case "fixed":
      return Math.max(0, basePrice - promo.discount_value);
    case "free_trial":
    case "lifetime_access":
    case "owner_grant":
      return 0;
    default:
      return basePrice;
  }
}

/** Human-readable description of promo benefit. */
export function formatPromoBenefit(promo: Pick<PromoCode, "discount_type" | "discount_value" | "plan_scope">): string {
  switch (promo.discount_type) {
    case "percent":
      return `${promo.discount_value}% off`;
    case "fixed":
      return `$${promo.discount_value.toFixed(2)} off`;
    case "free_trial":
      return `${promo.discount_value}-day free trial`;
    case "lifetime_access":
      return `Lifetime ${promo.plan_scope === "all" ? "plan" : promo.plan_scope} access`;
    case "owner_grant":
      return "Owner access grant";
    default:
      return "Discount applied";
  }
}

/** Validate promo code without redeeming (uses secure RPC). */
export async function validatePromoCode(
  code: string,
  planKey: PlanKey = "premium"
): Promise<PromoValidationResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { valid: false, error: "Enter a promo code." };
  }

  try {
    const { data, error } = await supabase.rpc("validate_promo_code", {
      p_code: trimmed,
      p_plan_key: planKey,
    });

    if (error) {
      if (isMissingTableError(error.message)) {
        return { valid: false, error: "Promo codes are not available yet." };
      }
      return { valid: false, error: error.message };
    }

    const result = data as { valid: boolean; error?: string; promo?: Record<string, unknown> };
    if (!result?.valid) {
      return { valid: false, error: result?.error ?? "Invalid promo code." };
    }

    return {
      valid: true,
      promo: result.promo ? mapPromoRow(result.promo) : undefined,
    };
  } catch (e: unknown) {
    return { valid: false, error: e instanceof Error ? e.message : "Failed to validate promo code." };
  }
}

/** Redeem promo: increment usage, grant entitlements when applicable. */
export async function redeemPromoCode(
  code: string,
  planKey: PlanKey = "premium"
): Promise<PromoRedemptionResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { success: false, error: "Enter a promo code." };
  }

  try {
    const { data, error } = await supabase.rpc("redeem_promo_code", {
      p_code: trimmed,
      p_plan_key: planKey,
    });

    if (error) {
      if (isMissingTableError(error.message)) {
        return { success: false, error: "Promo codes are not available yet." };
      }
      return { success: false, error: error.message };
    }

    const result = data as {
      success: boolean;
      error?: string;
      message?: string;
      granted_plan?: PlanKey | null;
      promo?: Record<string, unknown>;
    };

    if (!result?.success) {
      return { success: false, error: result?.error ?? "Failed to redeem promo code." };
    }

    const promo = result.promo ? mapPromoRow(result.promo) : undefined;

    return {
      success: true,
      message: result.message ?? "Promo code applied successfully!",
      promo,
      grantedPlan: (result.granted_plan as PlanKey | null) ?? null,
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to redeem promo code." };
  }
}

/** Grant entitlement after promo redemption (client-side fallback if RPC unavailable). */
export async function grantPromoEntitlement(
  userId: string,
  entitlement: EntitlementKey
): Promise<void> {
  const { error } = await supabase.from("user_entitlements").upsert(
    { user_id: userId, entitlement, granted_by: userId },
    { onConflict: "user_id,entitlement" }
  );

  if (error && !isMissingTableError(error.message)) {
    throw new Error(error.message);
  }
}

// ── Admin CRUD (backward-compatible aliases) ────────────────────

export async function fetchPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message)) return [];
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

export async function updatePromoCode(
  id: string,
  input: Partial<PromoCodeInput>
): Promise<PromoCode> {
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

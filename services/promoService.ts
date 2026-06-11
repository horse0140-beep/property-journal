import { supabase } from "@/lib/supabase";
import type { DiscountType, PlanKey, PromoCode } from "@/types/admin";

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

export async function fetchPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PromoCode[];
}

export async function createPromoCode(input: PromoCodeInput): Promise<PromoCode> {
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      ...input,
      code: input.code.toUpperCase().trim(),
    })
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

export async function deletePromoCode(id: string) {
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

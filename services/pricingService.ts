import { supabase } from "@/lib/supabase";
import type { PlanKey, PricingPlan } from "@/types/admin";

export type PricingPlanInput = {
  plan_key: PlanKey;
  name: string;
  monthly_price: number;
  yearly_price: number;
  description?: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export async function fetchPricingPlans(): Promise<PricingPlan[]> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PricingPlan[];
}

export async function createPricingPlan(input: PricingPlanInput): Promise<PricingPlan> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PricingPlan;
}

export async function updatePricingPlan(id: string, input: Partial<PricingPlanInput>): Promise<PricingPlan> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PricingPlan;
}

export async function deletePricingPlan(id: string) {
  const { error } = await supabase.from("pricing_plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

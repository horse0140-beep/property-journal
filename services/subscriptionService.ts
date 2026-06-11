import { supabase } from "@/lib/supabase";
import type { BillingCycle, PlanKey, Subscription, SubscriptionStatus } from "@/types/admin";

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

  if (error) throw new Error(error.message);

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

export async function deleteSubscription(id: string) {
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

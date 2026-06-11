import { Linking } from "react-native";
import { supabase } from "@/lib/supabase";
import type { StripeCustomerRecord } from "@/types/premium";
import type { PlanKey } from "@/types/admin";

const CHECKOUT_FUNCTION_URL = process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_URL ?? "";
const PAYMENT_LINKS: Record<string, string> = {
  premium: process.env.EXPO_PUBLIC_STRIPE_LINK_PREMIUM ?? "",
  landlord: process.env.EXPO_PUBLIC_STRIPE_LINK_LANDLORD ?? "",
  realtor: process.env.EXPO_PUBLIC_STRIPE_LINK_REALTOR ?? "",
};

export async function fetchStripeCustomer(userId: string): Promise<StripeCustomerRecord | null> {
  const { data, error } = await supabase
    .from("stripe_customers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as StripeCustomerRecord | null;
}

export async function upsertStripeCustomer(
  userId: string,
  updates: Partial<Pick<StripeCustomerRecord, "stripe_customer_id" | "stripe_subscription_id" | "plan_key" | "status" | "current_period_end">>
): Promise<StripeCustomerRecord> {
  const { data, error } = await supabase
    .from("stripe_customers")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as StripeCustomerRecord;
}

export async function startStripeCheckout(
  userId: string,
  userEmail: string,
  planKey: PlanKey
): Promise<{ url?: string; error?: string }> {
  if (CHECKOUT_FUNCTION_URL) {
    try {
      const res = await fetch(CHECKOUT_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail, planKey }),
      });

      const data = await res.json();
      if (data.url) return { url: data.url };
      return { error: data.error ?? "Checkout session failed" };
    } catch {
      return { error: "Could not reach billing server" };
    }
  }

  const paymentLink = PAYMENT_LINKS[planKey];
  if (paymentLink) {
    const url = `${paymentLink}?client_reference_id=${userId}&prefilled_email=${encodeURIComponent(userEmail)}`;
    return { url };
  }

  return {
    error:
      "Stripe is not configured. Set EXPO_PUBLIC_STRIPE_CHECKOUT_URL or payment link env vars in .env",
  };
}

export async function openStripeCheckout(
  userId: string,
  userEmail: string,
  planKey: PlanKey
): Promise<{ error?: string }> {
  const result = await startStripeCheckout(userId, userEmail, planKey);
  if (result.error) return { error: result.error };
  if (result.url) {
    const canOpen = await Linking.canOpenURL(result.url);
    if (!canOpen) return { error: "Cannot open checkout URL" };
    await Linking.openURL(result.url);
    await upsertStripeCustomer(userId, { plan_key: planKey, status: "pending" });
    return {};
  }
  return { error: "No checkout URL returned" };
}

export async function openStripePortal(customerId: string): Promise<{ error?: string }> {
  const portalUrl = process.env.EXPO_PUBLIC_STRIPE_PORTAL_URL;
  if (!portalUrl) {
    return { error: "Stripe Customer Portal URL not configured (EXPO_PUBLIC_STRIPE_PORTAL_URL)" };
  }
  const url = `${portalUrl}?customer=${customerId}`;
  await Linking.openURL(url);
  return {};
}

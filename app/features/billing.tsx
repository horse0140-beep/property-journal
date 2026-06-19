import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { PromoCodeBox } from "@/components/PromoCodeBox";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { displayPlanLabel, isPremiumUser } from "@/lib/premium";
import { fetchPricingPlans } from "@/services/pricingService";
import { applyPromoDiscount } from "@/services/promoService";
import type { PlanKey, PricingPlan, PromoCode } from "@/types/admin";
import {
  fetchStripeCustomer,
  openStripeCheckout,
  openStripePortal,
} from "@/services/stripeService";
import type { StripeCustomerRecord } from "@/types/premium";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: ["1 property", "Basic health score", "Manual entries"],
  premium: [
    "Unlimited properties",
    "Property sharing",
    "Buyer reports",
    "AI forecasting",
    "PDF reports",
  ],
  landlord: ["Everything in Premium", "Tenant sharing", "Bulk reports", "Contractor portal"],
  realtor: ["Everything in Premium", "Buyer share links", "Branded reports", "Client management"],
};

export default function StripeBillingScreen() {
  const { user, isAdmin, isOwner, updateProfile } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [stripeRecord, setStripeRecord] = useState<StripeCustomerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanKey | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("premium");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [pricing, stripe] = await Promise.all([
        fetchPricingPlans(),
        fetchStripeCustomer(user.id),
      ]);
      setPlans(pricing.filter((p) => p.plan_key !== "free"));
      setStripeRecord(stripe);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  function pricingFor(planKey: PlanKey): PricingPlan | undefined {
    return plans.find((p) => p.plan_key === planKey);
  }

  function displayPrice(planKey: PlanKey, cycle: "monthly" | "yearly"): number {
    const plan = pricingFor(planKey);
    const base = plan
      ? cycle === "monthly"
        ? Number(plan.monthly_price)
        : Number(plan.yearly_price)
      : cycle === "monthly"
        ? planKey === "premium"
          ? 4.99
          : planKey === "landlord"
            ? 14.99
            : 29.99
        : planKey === "premium"
          ? 39.99
          : planKey === "landlord"
            ? 149.99
            : 299.99;

    if (
      appliedPromo &&
      (appliedPromo.plan_scope === "all" ||
        appliedPromo.plan_scope === planKey)
    ) {
      return applyPromoDiscount(base, appliedPromo);
    }
    return base;
  }

  async function handleSubscribe(planKey: PlanKey) {
    if (!user?.id || !user.email) return;
    setCheckoutPlan(planKey);
    const result = await openStripeCheckout(user.id, user.email, planKey);
    setCheckoutPlan(null);
    if (result.error) {
      Alert.alert("Billing", result.error);
    }
  }

  async function handleManageBilling() {
    if (!stripeRecord?.stripe_customer_id) {
      Alert.alert("Billing", "No active Stripe customer record found. Subscribe to a plan first.");
      return;
    }
    const result = await openStripePortal(stripeRecord.stripe_customer_id);
    if (result.error) Alert.alert("Billing", result.error);
  }

  async function handlePromoApplied(result: {
    success: boolean;
    grantedPlan?: PlanKey | null;
    promo?: PromoCode;
    message?: string;
  }) {
    if (!result.success) return;

    if (result.promo) setAppliedPromo(result.promo);

    if (result.grantedPlan && result.grantedPlan !== "free") {
      await updateProfile({ plan: result.grantedPlan });
      Alert.alert("Access Granted", result.message ?? "Your plan has been updated!");
    }
  }

  const premium = isPremiumUser(user?.plan, isAdmin, user?.email);
  const selectedPricing = pricingFor(selectedPlan);

  return (
    <Screen noPad>
      <AdminHeader title="Stripe Billing" subtitle="Manage your subscription" backTo="/features" />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Card elevated>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.label}>Current Plan</Text>
                <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>
                  {displayPlanLabel(user?.plan, { isAdmin, email: user?.email, isOwner })}
                </Text>
              </View>
              <AdminBadge label={premium ? "Active" : "Free"} variant={premium ? "success" : "muted"} />
            </View>
            {stripeRecord?.current_period_end && (
              <Text style={[styles.muted, { marginTop: 10 }]}>
                Renews {new Date(stripeRecord.current_period_end).toLocaleDateString()}
              </Text>
            )}
            {stripeRecord?.stripe_subscription_id && (
              <Text style={[styles.muted, { marginTop: 4, fontSize: 11 }]}>
                Sub: {stripeRecord.stripe_subscription_id.slice(0, 20)}…
              </Text>
            )}
          </Card>

          {!isAdmin && !isOwner ? (
            <View style={{ marginTop: 14 }}>
              <PromoCodeBox
                selectedPlan={selectedPlan}
                monthlyPrice={
                  selectedPricing ? Number(selectedPricing.monthly_price) : undefined
                }
                yearlyPrice={selectedPricing ? Number(selectedPricing.yearly_price) : undefined}
                onApplied={handlePromoApplied}
              />
            </View>
          ) : null}

          {premium && stripeRecord?.stripe_customer_id && (
            <Pressable style={styles.secondaryButton} onPress={handleManageBilling}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Manage Payment Method</Text>
            </Pressable>
          )}

          <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Choose a Plan</Text>

          {(plans.length > 0
            ? plans
            : [
                {
                  plan_key: "premium" as PlanKey,
                  name: "Premium",
                  monthly_price: 4.99,
                  yearly_price: 39.99,
                  description: "For homeowners",
                },
                {
                  plan_key: "landlord" as PlanKey,
                  name: "Landlord Pro",
                  monthly_price: 14.99,
                  yearly_price: 149.99,
                  description: "Multiple rentals",
                },
                {
                  plan_key: "realtor" as PlanKey,
                  name: "Realtor Pro",
                  monthly_price: 29.99,
                  yearly_price: 299.99,
                  description: "For agents",
                },
              ]
          ).map((plan) => {
            const key = plan.plan_key as PlanKey;
            const isCurrent = user?.plan === key;
            const features = PLAN_FEATURES[key] ?? [];
            const monthly = displayPrice(key, "monthly");
            const yearly = displayPrice(key, "yearly");
            const baseMonthly = pricingFor(key)
              ? Number(pricingFor(key)!.monthly_price)
              : monthly;
            const hasPromo = appliedPromo && monthly < baseMonthly;

            return (
              <Pressable key={key} onPress={() => setSelectedPlan(key)}>
                <Card
                  style={{
                    marginBottom: 12,
                    borderColor: selectedPlan === key ? colors.primary : colors.border,
                    borderWidth: selectedPlan === key ? 2 : 1,
                  }}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{plan.name}</Text>
                    {isCurrent && <AdminBadge label="Current" variant="success" />}
                  </View>
                  {"description" in plan && plan.description && (
                    <Text style={styles.muted}>{plan.description}</Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
                    <View>
                      <Text style={styles.label}>Monthly</Text>
                      <Text style={styles.price}>
                        ${monthly.toFixed(2)}
                        {hasPromo ? (
                          <Text style={{ color: colors.success, fontSize: 12 }}> promo</Text>
                        ) : null}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.label}>Yearly</Text>
                      <Text style={styles.price}>${yearly.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 12, gap: 6 }}>
                    {features.map((f) => (
                      <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  {!isCurrent && (
                    <Pressable
                      style={[styles.primaryButton, checkoutPlan === key && { opacity: 0.7 }]}
                      onPress={() => handleSubscribe(key)}
                      disabled={!!checkoutPlan}
                    >
                      {checkoutPlan === key ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="card-outline" size={18} color="#fff" />
                          <Text style={styles.primaryButtonText}>Subscribe with Stripe</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </Card>
              </Pressable>
            );
          })}

          <Card style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.muted, { flex: 1, lineHeight: 20 }]}>
                Payments are processed securely by Stripe. Configure EXPO_PUBLIC_STRIPE_CHECKOUT_URL
                or payment link env vars to enable live checkout.
              </Text>
            </View>
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

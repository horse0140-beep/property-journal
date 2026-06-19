import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { PromoCodeBox } from "@/components/PromoCodeBox";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { displayPlanLabel, isPremiumUser, planLabel } from "@/lib/premium";
import { getPricingPlans } from "@/services/adminService";
import { applyPromoDiscount } from "@/services/promoService";
import type { UserProfile } from "@/context/AuthContext";
import type { PlanKey, PricingPlan, PromoCode } from "@/types/admin";
import type { SubscriptionPackage } from "@/services/revenueCatService";

const PLAN_FEATURES: Record<UserProfile["plan"], string[]> = {
  free: ["1 property", "Basic health score", "Manual entries"],
  premium: [
    "Unlimited properties",
    "PDF reports",
    "Buyer share links",
    "Cloud backup",
    "AI maintenance forecasting",
    "Property sharing",
  ],
  landlord: [
    "Everything in Premium",
    "Landlord Pro dashboard",
    "Tenant sharing",
    "Bulk reports",
    "Contractor portal",
  ],
  realtor: [
    "Everything in Premium",
    "Realtor Pro tools",
    "Branded reports",
    "Buyer share links",
    "Client management",
  ],
};

const PLAN_ORDER: PlanKey[] = ["premium", "landlord", "realtor"];

const PLAN_COLORS: Record<PlanKey, string> = {
  free: colors.textMuted,
  premium: colors.primary,
  landlord: colors.success,
  realtor: colors.gold,
};

function groupPackages(packages: SubscriptionPackage[]) {
  const grouped: Partial<Record<PlanKey, SubscriptionPackage[]>> = {};
  for (const pkg of packages) {
    if (!grouped[pkg.plan]) grouped[pkg.plan] = [];
    grouped[pkg.plan]!.push(pkg);
  }
  return grouped;
}

export default function PremiumUpgradeScreen() {
  const { user, isAdmin, isOwner, updateProfile } = useAuth();
  const { isConfigured, packages, isLoading, error, purchase, restore, refresh, activePlan } =
    useSubscription();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("premium");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);

  const grouped = useMemo(() => groupPackages(packages), [packages]);
  const premium = isPremiumUser(user?.plan, isAdmin, user?.email);

  const loadPricing = useCallback(async () => {
    try {
      const plans = await getPricingPlans();
      setPricingPlans(plans.filter((p) => p.plan_key !== "free"));
    } catch {
      setPricingPlans([]);
    }
  }, []);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  function pricingFor(planKey: PlanKey): PricingPlan | undefined {
    return pricingPlans.find((p) => p.plan_key === planKey);
  }

  function displayPrice(planKey: PlanKey, cycle: "monthly" | "yearly"): string | null {
    const plan = pricingFor(planKey);
    if (!plan) return null;
    const base = cycle === "monthly" ? Number(plan.monthly_price) : Number(plan.yearly_price);
    if (appliedPromo && (planKey === selectedPlan || appliedPromo.plan_scope === "all" || appliedPromo.plan_scope === planKey)) {
      const discounted = applyPromoDiscount(base, appliedPromo);
      if (discounted < base) {
        return `$${discounted.toFixed(2)}`;
      }
    }
    return `$${base.toFixed(2)}`;
  }

  async function handlePurchase(packageId: string) {
    setPurchasingId(packageId);
    const result = await purchase(packageId);
    setPurchasingId(null);

    if (result.error) {
      Alert.alert("Purchase Failed", result.error);
      return;
    }

    Alert.alert("Success", "Your subscription is now active. Thank you for upgrading!");
  }

  async function handleRestore() {
    setRestoring(true);
    const result = await restore();
    setRestoring(false);

    if (result.error) {
      Alert.alert("Restore Failed", result.error);
      return;
    }

    if (result.plan && result.plan !== "free") {
      Alert.alert(
        "Restored",
        `Your ${planLabel(result.plan as UserProfile["plan"])} subscription has been restored.`
      );
    } else {
      Alert.alert("No Purchases", "No active subscriptions were found for this account.");
    }
  }

  async function handlePromoApplied(result: {
    success: boolean;
    grantedPlan?: PlanKey | null;
    promo?: PromoCode;
    message?: string;
  }) {
    if (!result.success) return;

    if (result.promo) {
      setAppliedPromo(result.promo);
    }

    if (result.grantedPlan && result.grantedPlan !== "free") {
      await updateProfile({ plan: result.grantedPlan });
      Alert.alert("Access Granted", result.message ?? "Your plan has been updated!");
    }
  }

  const selectedPricing = pricingFor(selectedPlan);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Back</Text>
        </Pressable>

        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 12,
              fontWeight: "800",
              letterSpacing: 1,
            }}
          >
            HOMEWISE PREMIUM
          </Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 6 }}>
            Upgrade Your Plan
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 8, lineHeight: 22 }}>
            Current plan: {displayPlanLabel(user?.plan, { isAdmin, email: user?.email, isOwner })}
            {premium && !isAdmin && !isOwner ? " ✓" : ""}
          </Text>
        </View>

        {isAdmin || isOwner ? (
          <Card style={{ backgroundColor: colors.successBg, borderColor: colors.success }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Ionicons name="shield-checkmark" size={24} color={colors.success} />
              <Text style={{ color: colors.success, fontWeight: "700", flex: 1 }}>
                Admin accounts have all premium features unlocked automatically.
              </Text>
            </View>
          </Card>
        ) : (
          <PromoCodeBox
            selectedPlan={selectedPlan}
            monthlyPrice={selectedPricing ? Number(selectedPricing.monthly_price) : undefined}
            yearlyPrice={selectedPricing ? Number(selectedPricing.yearly_price) : undefined}
            onApplied={handlePromoApplied}
          />
        )}

        {error ? (
          <Card style={{ backgroundColor: colors.dangerBg, borderColor: colors.danger, marginTop: 12 }}>
            <Text style={{ color: colors.danger }}>{error}</Text>
            <Pressable style={[styles.secondaryButton, { marginTop: 10 }]} onPress={refresh}>
              <Text style={styles.secondaryButtonText}>Retry</Text>
            </Pressable>
          </Card>
        ) : null}

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.muted, { marginTop: 12 }]}>Loading subscription options…</Text>
          </View>
        ) : (
          <>
            {PLAN_ORDER.map((planKey) => {
              const planPackages = grouped[planKey] ?? [];
              const isCurrent = activePlan === planKey || user?.plan === planKey;
              const planPricing = pricingFor(planKey);
              const monthlyDisplay = displayPrice(planKey, "monthly");
              const yearlyDisplay = displayPrice(planKey, "yearly");

              return (
                <Pressable key={planKey} onPress={() => setSelectedPlan(planKey)}>
                  <Card
                    elevated
                    style={{
                      marginBottom: 14,
                      borderWidth: selectedPlan === planKey ? 2 : 1,
                      borderColor: selectedPlan === planKey ? colors.primary : colors.border,
                    }}
                  >
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={styles.label}>Plan</Text>
                        <Text
                          style={{
                            color: PLAN_COLORS[planKey],
                            fontSize: 22,
                            fontWeight: "900",
                          }}
                        >
                          {planLabel(planKey)}
                        </Text>
                        {planPricing && monthlyDisplay ? (
                          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                            {monthlyDisplay}/mo
                            {yearlyDisplay ? ` · ${yearlyDisplay}/yr` : ""}
                            {appliedPromo &&
                            (appliedPromo.plan_scope === "all" || appliedPromo.plan_scope === planKey) ? (
                              <Text style={{ color: colors.success, fontWeight: "700" }}> (promo)</Text>
                            ) : null}
                          </Text>
                        ) : null}
                      </View>
                      {isCurrent ? (
                        <View
                          style={{
                            backgroundColor: colors.successBg,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ color: colors.success, fontSize: 11, fontWeight: "800" }}>
                            ACTIVE
                          </Text>
                        </View>
                      ) : selectedPlan === planKey ? (
                        <Ionicons name="radio-button-on" size={22} color={colors.primary} />
                      ) : (
                        <Ionicons name="radio-button-off" size={22} color={colors.textMuted} />
                      )}
                    </View>

                    {PLAN_FEATURES[planKey].map((f) => (
                      <View
                        key={f}
                        style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}
                      >
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{f}</Text>
                      </View>
                    ))}

                    {planPackages.length > 0 ? (
                      <View style={{ marginTop: 16, gap: 10 }}>
                        {planPackages.map((pkg) => (
                          <Pressable
                            key={pkg.identifier}
                            style={[
                              styles.primaryButton,
                              { backgroundColor: PLAN_COLORS[planKey] },
                              purchasingId === pkg.identifier && { opacity: 0.7 },
                            ]}
                            onPress={() => handlePurchase(pkg.identifier)}
                            disabled={!!purchasingId || isCurrent}
                          >
                            {purchasingId === pkg.identifier ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Ionicons name="card-outline" size={18} color="#fff" />
                            )}
                            <Text style={styles.primaryButtonText}>
                              {pkg.title} — {pkg.price}
                              {pkg.period === "yearly" ? "/yr" : pkg.period === "monthly" ? "/mo" : ""}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : !isConfigured ? (
                      <Text style={[styles.muted, { marginTop: 14 }]}>
                        In-app purchases require a native build with RevenueCat API keys configured.
                        You can also subscribe via Stripe Billing.
                      </Text>
                    ) : (
                      <Text style={[styles.muted, { marginTop: 14 }]}>
                        No packages available for this plan in RevenueCat yet.
                      </Text>
                    )}
                  </Card>
                </Pressable>
              );
            })}

            {!isConfigured ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => router.push("/features/billing")}
              >
                <Ionicons name="card-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Subscribe with Stripe</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.ghostButton, restoring && { opacity: 0.6 }]}
              onPress={handleRestore}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.ghostButtonText}>Restore Purchases</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

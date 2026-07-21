import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { LoadingView } from "@/components/LoadingView";
import { PlanCard } from "@/components/PlanCard";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { displayPlanLabel } from "@/lib/premium";
import { OWNER_ADMIN_EMAIL } from "@/lib/admin";
import {
  formatPromoBenefit,
  redeemPromoCode,
  validatePromoCode,
} from "@/services/promoService";
import {
  canUpgradeTo,
  getDiscountedPrices,
  getSubscriptionPlans,
  packagesForPlan,
  SUBSCRIPTION_PLAN_ORDER,
  type DiscountedPrices,
  type SubscriptionPlanInfo,
} from "@/services/subscriptionService";
import type { PlanKey, PromoCode } from "@/types/admin";

export default function SubscriptionCenterScreen() {
  const { user, isOwner, isAdmin, updateProfile } = useAuth();
  const { purchase, restore, refresh: refreshRc, isLoading: rcLoading, error: rcError, packages: rcPackages, isConfigured: revenueCatConfigured } =
    useSubscription();

  const [plans, setPlans] = useState<SubscriptionPlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("premium");
  const [promoCode, setPromoCode] = useState("");
  const [previewPromo, setPreviewPromo] = useState<PromoCode | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoError, setPromoError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const currentPlan = (user?.plan ?? "free") as PlanKey;
  const ownerAccount = isOwner || user?.email?.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase();

  const load = useCallback(async () => {
    try {
      setError("");
      setPlans(await getSubscriptionPlans());
      await refreshRc();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load subscription center");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshRc]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const activePromo = appliedPromo ?? previewPromo;

  function planInfo(planKey: PlanKey): SubscriptionPlanInfo | undefined {
    return plans.find((p) => p.planKey === planKey);
  }

  function selectedPlanPricing(): DiscountedPrices {
    const plan = planInfo(selectedPlan);
    if (!plan) return { monthly: 0, yearly: 0, hasDiscount: false };
    return getDiscountedPrices(plan, activePromo, selectedPlan);
  }

  async function handlePreviewDiscount() {
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code.");
      return;
    }

    setPreviewing(true);
    setPromoError("");
    setPromoMessage("");

    const result = await validatePromoCode(promoCode, selectedPlan);
    setPreviewing(false);

    if (!result.valid || !result.promo) {
      setPreviewPromo(null);
      setPromoError(result.error ?? "Invalid promo code.");
      return;
    }

    setPreviewPromo(result.promo);
    setPromoMessage(`Preview: ${result.promo.code} — ${formatPromoBenefit(result.promo)}`);
  }

  async function handleRedeem() {
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code.");
      return;
    }

    setRedeeming(true);
    setPromoError("");
    setPromoMessage("");

    const result = await redeemPromoCode(promoCode, selectedPlan);
    setRedeeming(false);

    if (!result.success) {
      setPromoError(result.error ?? "Could not redeem promo code.");
      return;
    }

    if (result.promo) {
      setAppliedPromo(result.promo);
      setPreviewPromo(null);
    }

    setPromoMessage(result.message ?? "Promo code redeemed!");

    if (result.grantedPlan && result.grantedPlan !== "free") {
      await updateProfile({ plan: result.grantedPlan });
      Alert.alert("Access Granted", result.message ?? "Your plan has been updated.");
      await load();
    }
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
    await load();
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
      Alert.alert("Restored", "Your subscription has been restored.");
      await load();
    } else {
      Alert.alert("No Purchases", "No active subscriptions were found for this account.");
    }
  }

  function handleUpgrade(planKey: PlanKey) {
    if (revenueCatConfigured) {
      const pkgs = packagesForPlan(rcPackages, planKey);
      if (pkgs.length > 0) {
        handlePurchase(pkgs[0].identifier);
      }
      return;
    }
    router.push("/features/billing");
  }

  const selectedPrices = selectedPlanPricing();

  if (loading && plans.length === 0) {
    return (
      <Screen>
        <LoadingView message="Loading subscription center…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
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
            borderRadius: 22,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 11,
              fontWeight: "900",
              letterSpacing: 1.2,
            }}
          >
            PROPERTY JOURNAL
          </Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 6 }}>
            Subscription Center
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 8, fontSize: 14 }}>
            Current: {displayPlanLabel(user?.plan, { isAdmin, email: user?.email, isOwner })}
          </Text>
        </View>

        {ownerAccount && (
          <Card
            style={{
              backgroundColor: colors.gold,
              borderColor: colors.gold,
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Ionicons name="shield-checkmark" size={28} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                  OWNER ACCESS
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 4, fontSize: 13 }}>
                  ALL FEATURES UNLOCKED
                </Text>
              </View>
            </View>
          </Card>
        )}

        {!revenueCatConfigured && !ownerAccount && (
          <Card style={{ backgroundColor: colors.infoBg, borderColor: colors.info, marginBottom: 14 }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Ionicons name="time-outline" size={24} color={colors.info} />
              <Text style={{ color: colors.info, fontWeight: "700", flex: 1, lineHeight: 20 }}>
                Subscriptions Coming Soon — In-app purchases require a native build with RevenueCat
                keys. You can still redeem promo codes{Platform.OS !== "ios" ? " or subscribe via Stripe" : ""}.
              </Text>
            </View>
          </Card>
        )}

        {(error || rcError) && (
          <Card style={{ backgroundColor: colors.dangerBg, borderColor: colors.danger, marginBottom: 14 }}>
            <Text style={{ color: colors.danger, fontWeight: "600" }}>
              {error || rcError}
            </Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                load();
              }}
              style={{ marginTop: 10 }}
            >
              <Text style={{ color: colors.danger, fontWeight: "800" }}>Tap to retry</Text>
            </Pressable>
          </Card>
        )}

        {!ownerAccount && (
          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ionicons name="ticket-outline" size={20} color={colors.primary} />
              <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 16 }}>
                Promo Code
              </Text>
            </View>

            <Text style={[styles.muted, { marginBottom: 10 }]}>
              Select a plan below, then preview or redeem your code.
            </Text>

            <TextInput
              style={[styles.input, { fontWeight: "700", letterSpacing: 1 }]}
              placeholder="ENTER PROMO CODE"
              placeholderTextColor={colors.textMuted}
              value={promoCode}
              onChangeText={(v) => {
                setPromoCode(v.toUpperCase());
                setPromoError("");
                setPromoMessage("");
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={handlePreviewDiscount}
                disabled={previewing || !promoCode.trim()}
                style={[
                  styles.secondaryButton,
                  { flex: 1, marginTop: 0, opacity: previewing || !promoCode.trim() ? 0.6 : 1 },
                ]}
              >
                {previewing ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Preview Discount</Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleRedeem}
                disabled={redeeming || !promoCode.trim()}
                style={[
                  styles.primaryButton,
                  { flex: 1, marginTop: 0, opacity: redeeming || !promoCode.trim() ? 0.6 : 1 },
                ]}
              >
                {redeeming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Redeem</Text>
                )}
              </Pressable>
            </View>

            {promoError ? (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 10, alignItems: "center" }}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{promoError}</Text>
              </View>
            ) : null}

            {promoMessage ? (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 10, alignItems: "center" }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 13, flex: 1, fontWeight: "600" }}>
                  {promoMessage}
                </Text>
              </View>
            ) : null}

            {activePromo && selectedPrices.hasDiscount ? (
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: colors.bgSection,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>
                  DISCOUNT PREVIEW — {planInfo(selectedPlan)?.name ?? selectedPlan}
                </Text>
                <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 18, marginTop: 4 }}>
                  ${selectedPrices.monthly.toFixed(2)}/mo · ${selectedPrices.yearly.toFixed(2)}/yr
                </Text>
              </View>
            ) : null}
          </Card>
        )}

        {rcLoading && revenueCatConfigured ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.muted, { marginTop: 8 }]}>Loading store products…</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionHeader, { marginBottom: 12 }]}>Plans</Text>

        {SUBSCRIPTION_PLAN_ORDER.map((planKey) => {
          const plan = planInfo(planKey);
          if (!plan) return null;

          const prices = getDiscountedPrices(plan, activePromo, selectedPlan);
          const isCurrent = currentPlan === planKey;

          return (
            <PlanCard
              key={planKey}
              plan={plan}
              isCurrent={isCurrent}
              isOwner={ownerAccount}
              monthlyPrice={prices.monthly}
              yearlyPrice={prices.yearly}
              hasDiscount={prices.hasDiscount}
              originalMonthly={plan.monthlyPrice}
              originalYearly={plan.yearlyPrice}
              revenueCatConfigured={revenueCatConfigured}
              packages={packagesForPlan(rcPackages, planKey)}
              canUpgrade={!ownerAccount && canUpgradeTo(currentPlan, planKey)}
              purchasingId={purchasingId}
              onUpgrade={() => handleUpgrade(planKey)}
              onPurchase={handlePurchase}
              selected={selectedPlan === planKey}
              onSelect={() => setSelectedPlan(planKey)}
            />
          );
        })}

        {revenueCatConfigured && !ownerAccount && (
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
        )}

        {!revenueCatConfigured && !ownerAccount && Platform.OS !== "ios" && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/features/billing")}
          >
            <Ionicons name="card-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Subscribe with Stripe</Text>
          </Pressable>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import {
  PLAN_COLORS,
  type SubscriptionPlanInfo,
} from "@/services/subscriptionService";
import type { PlanKey } from "@/types/admin";
import type { SubscriptionPackage } from "@/services/revenueCatService";

type Props = {
  plan: SubscriptionPlanInfo;
  isCurrent: boolean;
  isOwner?: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  hasDiscount?: boolean;
  originalMonthly?: number;
  originalYearly?: number;
  revenueCatConfigured?: boolean;
  packages?: SubscriptionPackage[];
  canUpgrade?: boolean;
  purchasingId?: string | null;
  onUpgrade?: () => void;
  onPurchase?: (packageId: string) => void;
  selected?: boolean;
  onSelect?: () => void;
};

export function PlanCard({
  plan,
  isCurrent,
  isOwner = false,
  monthlyPrice,
  yearlyPrice,
  hasDiscount = false,
  originalMonthly,
  originalYearly,
  revenueCatConfigured = false,
  packages = [],
  canUpgrade = false,
  purchasingId = null,
  onUpgrade,
  onPurchase,
  selected = false,
  onSelect,
}: Props) {
  const accent = PLAN_COLORS[plan.planKey];
  const isFree = plan.planKey === "free";
  const showStrike =
    hasDiscount &&
    originalMonthly != null &&
    originalMonthly > 0 &&
    monthlyPrice < originalMonthly;

  return (
    <Pressable onPress={onSelect} disabled={!onSelect}>
      <View
        style={[
          {
            backgroundColor: colors.bgCard,
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
            borderWidth: selected || isCurrent ? 2 : 1,
            borderColor: selected || isCurrent ? colors.primary : colors.border,
          },
          selected ? { borderColor: accent } : null,
        ]}
      >
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>
              PLAN
            </Text>
            <Text style={{ color: accent, fontSize: 24, fontWeight: "900", marginTop: 2 }}>
              {plan.name}
            </Text>
            {plan.description ? (
              <Text style={[styles.muted, { marginTop: 4 }]}>{plan.description}</Text>
            ) : null}
          </View>

          {isCurrent ? (
            <View
              style={{
                backgroundColor: colors.successBg,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: colors.success, fontSize: 11, fontWeight: "900" }}>
                CURRENT PLAN
              </Text>
            </View>
          ) : selected ? (
            <Ionicons name="radio-button-on" size={22} color={accent} />
          ) : null}
        </View>

        {!isFree && (
          <View style={{ flexDirection: "row", gap: 24, marginTop: 16 }}>
            <View>
              <Text style={styles.label}>Monthly</Text>
              {showStrike ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    textDecorationLine: "line-through",
                  }}
                >
                  ${originalMonthly!.toFixed(2)}
                </Text>
              ) : null}
              <Text style={[styles.price, { color: accent }]}>
                ${monthlyPrice.toFixed(2)}
                {hasDiscount ? (
                  <Text style={{ color: colors.success, fontSize: 12 }}> promo</Text>
                ) : null}
              </Text>
            </View>
            <View>
              <Text style={styles.label}>Yearly</Text>
              {showStrike && originalYearly != null && originalYearly > 0 ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    textDecorationLine: "line-through",
                  }}
                >
                  ${originalYearly.toFixed(2)}
                </Text>
              ) : null}
              <Text style={[styles.price, { color: accent }]}>${yearlyPrice.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {isFree && (
          <Text style={{ color: colors.success, fontWeight: "800", marginTop: 14, fontSize: 16 }}>
            $0 — Always free
          </Text>
        )}

        <View style={{ marginTop: 14, gap: 8 }}>
          {plan.features.map((feature) => (
            <View key={feature} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>{feature}</Text>
            </View>
          ))}
        </View>

        {isOwner ? (
          <View
            style={{
              marginTop: 16,
              backgroundColor: colors.gold,
              borderRadius: 12,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13, flex: 1 }}>
              ALL FEATURES UNLOCKED
            </Text>
          </View>
        ) : isCurrent ? null : canUpgrade ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            {revenueCatConfigured && packages.length > 0 ? (
              packages.map((pkg) => (
                <Pressable
                  key={pkg.identifier}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: accent, marginTop: 0 },
                    purchasingId === pkg.identifier && { opacity: 0.7 },
                  ]}
                  onPress={() => onPurchase?.(pkg.identifier)}
                  disabled={!!purchasingId}
                >
                  {purchasingId === pkg.identifier ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
                  )}
                  <Text style={styles.primaryButtonText}>
                    Upgrade — {pkg.title} ({pkg.price}
                    {pkg.period === "yearly" ? "/yr" : pkg.period === "monthly" ? "/mo" : ""})
                  </Text>
                </Pressable>
              ))
            ) : (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: accent, marginTop: 0 }]}
                onPress={onUpgrade}
              >
                <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Upgrade to {plan.name}</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

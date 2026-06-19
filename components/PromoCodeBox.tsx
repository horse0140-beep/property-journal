import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import type { PlanKey, PromoCode } from "@/types/admin";
import {
  applyPromoDiscount,
  formatPromoBenefit,
  redeemPromoCode,
  type PromoRedemptionResult,
} from "@/services/promoService";

type Props = {
  selectedPlan?: PlanKey;
  monthlyPrice?: number;
  yearlyPrice?: number;
  onApplied?: (result: PromoRedemptionResult & { promo?: PromoCode }) => void;
  compact?: boolean;
};

export function PromoCodeBox({
  selectedPlan = "premium",
  monthlyPrice,
  yearlyPrice,
  onApplied,
  compact = false,
}: Props) {
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);

  async function handleApply() {
    setApplying(true);
    setError("");
    setMessage("");

    const result = await redeemPromoCode(code, selectedPlan);
    setApplying(false);

    if (!result.success) {
      setError(result.error ?? "Invalid promo code.");
      setAppliedPromo(null);
      onApplied?.(result);
      return;
    }

    setAppliedPromo(result.promo ?? null);
    setMessage(result.message ?? "Promo code applied!");

    const enriched: PromoRedemptionResult & { promo?: PromoCode } = {
      ...result,
      discountedMonthly:
        result.promo && monthlyPrice != null
          ? applyPromoDiscount(monthlyPrice, result.promo)
          : undefined,
      discountedYearly:
        result.promo && yearlyPrice != null
          ? applyPromoDiscount(yearlyPrice, result.promo)
          : undefined,
    };

    onApplied?.(enriched);
  }

  const showDiscount =
    appliedPromo &&
    (appliedPromo.discount_type === "percent" || appliedPromo.discount_type === "fixed") &&
    monthlyPrice != null;

  return (
    <View
      style={{
        backgroundColor: colors.bgSection,
        borderRadius: compact ? 12 : 16,
        padding: compact ? 14 : 18,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: compact ? 0 : 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ionicons name="ticket-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 15 }}>
          Have a promo code?
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[
            styles.input,
            {
              flex: 1,
              marginBottom: 0,
              fontWeight: "700",
              letterSpacing: 1,
            },
          ]}
          placeholder="ENTER CODE"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase());
            setError("");
            setMessage("");
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!applying}
        />
        <Pressable
          onPress={handleApply}
          disabled={applying || !code.trim()}
          style={[
            styles.primaryButton,
            {
              marginTop: 0,
              paddingHorizontal: 12,
              minWidth: 110,
              opacity: applying || !code.trim() ? 0.6 : 1,
            },
          ]}
        >
          {applying ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.primaryButtonText, { fontSize: 13 }]}>Apply Promo Code</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Ionicons name="close-circle" size={16} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      ) : null}

      {message ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 13, flex: 1, fontWeight: "600" }}>
            {message}
          </Text>
        </View>
      ) : null}

      {appliedPromo ? (
        <View style={{ marginTop: 10, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {appliedPromo.code} — {formatPromoBenefit(appliedPromo)}
          </Text>
          {showDiscount && monthlyPrice != null ? (
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
              Discounted: $
              {applyPromoDiscount(monthlyPrice, appliedPromo).toFixed(2)}/mo
              {yearlyPrice != null
                ? ` · $${applyPromoDiscount(yearlyPrice, appliedPromo).toFixed(2)}/yr`
                : ""}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

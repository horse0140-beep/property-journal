import { useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, styles } from "@/constants/theme";
import { useUpgrade } from "@/context/UpgradeContext";
import { useAuth } from "@/context/AuthContext";
import { PromoCodeBox } from "@/components/PromoCodeBox";
import {
  displayPlanLabel,
  FEATURE_DESCRIPTIONS,
  FEATURE_LABELS,
  planLabel,
  requiredPlanForFeature,
} from "@/lib/premium";
import type { PlanKey } from "@/types/admin";

const PREMIUM_INCLUDES = [
  "Unlimited properties",
  "PDF home history reports",
  "Buyer share links",
  "Cloud backup & sync",
  "AI maintenance forecasting",
];

export function UpgradeModal() {
  const { visible, activeFeature, hideUpgrade } = useUpgrade();
  const { user, isAdmin, isOwner, updateProfile } = useAuth();
  const [promoSuccess, setPromoSuccess] = useState("");

  if (!activeFeature) return null;

  const requiredPlan = requiredPlanForFeature(activeFeature) as PlanKey;
  const featureName = FEATURE_LABELS[activeFeature];
  const description = FEATURE_DESCRIPTIONS[activeFeature];

  function handleUpgrade() {
    hideUpgrade();
    router.push("/features/upgrade");
  }

  async function handlePromoApplied(result: {
    success: boolean;
    grantedPlan?: PlanKey | null;
    message?: string;
  }) {
    if (!result.success) {
      setPromoSuccess("");
      return;
    }

    setPromoSuccess(result.message ?? "Promo applied!");

    if (result.grantedPlan && result.grantedPlan !== "free") {
      await updateProfile({ plan: result.grantedPlan });
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={hideUpgrade}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,31,61,0.55)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: colors.bgSection,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="lock-closed" size={30} color={colors.gold} />
            </View>
          </View>

          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 22,
              fontWeight: "900",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {featureName}
          </Text>

          <Text
            style={{
              color: colors.textMuted,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 16,
            }}
          >
            {description}
          </Text>

          <View
            style={{
              backgroundColor: colors.bgSection,
              borderRadius: 14,
              padding: 14,
              marginBottom: 18,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
              {requiredPlan === "premium"
                ? "Upgrade to Premium to unlock:"
                : `Upgrade to ${planLabel(requiredPlan)} to unlock:`}
            </Text>
            {PREMIUM_INCLUDES.map((item) => (
              <View
                key={item}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item}</Text>
              </View>
            ))}
          </View>

          {!isAdmin && !isOwner ? (
            <PromoCodeBox
              selectedPlan={requiredPlan}
              onApplied={handlePromoApplied}
              compact
            />
          ) : null}

          {promoSuccess ? (
            <Text
              style={{
                color: colors.success,
                fontSize: 13,
                textAlign: "center",
                marginTop: 10,
                fontWeight: "600",
              }}
            >
              {promoSuccess}
            </Text>
          ) : null}

          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              textAlign: "center",
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            Current plan: {displayPlanLabel(user?.plan, { isAdmin, email: user?.email, isOwner })}
            {isAdmin || isOwner ? " — all features unlocked" : ""}
          </Text>

          <Pressable style={styles.primaryButton} onPress={handleUpgrade}>
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>View Upgrade Options</Text>
          </Pressable>

          <Pressable style={styles.ghostButton} onPress={hideUpgrade}>
            <Text style={styles.ghostButtonText}>Not Now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

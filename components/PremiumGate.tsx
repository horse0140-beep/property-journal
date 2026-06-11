import { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  FEATURE_DESCRIPTIONS,
  hasFeatureAccess,
  type PremiumFeature,
} from "@/lib/premium";

type Props = {
  children: ReactNode;
  featureName: string;
  description: string;
  feature?: PremiumFeature;
};

export function PremiumGate({ children, featureName, description, feature }: Props) {
  const { user, isAdmin } = useAuth();

  const unlocked = feature
    ? hasFeatureAccess(feature, user?.plan, isAdmin)
    : hasFeatureAccess("property_sharing", user?.plan, isAdmin);

  if (unlocked) {
    return <>{children}</>;
  }

  const body = description || (feature ? FEATURE_DESCRIPTIONS[feature] : "");

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="star" size={36} color={colors.gold} />
        </View>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          {featureName}
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 14,
            textAlign: "center",
            marginTop: 8,
            lineHeight: 22,
          }}
        >
          {body}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 20,
        }}
      >
        {[
          "Unlimited Properties",
          "PDF Reports",
          "Buyer Share Links",
          "Cloud Backup",
          "AI Maintenance Forecasting",
        ].map((f) => (
          <View
            key={f}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{f}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={() => router.push("/features/upgrade")}>
        <Ionicons name="star" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Upgrade to Premium</Text>
      </Pressable>

      <Pressable style={styles.ghostButton} onPress={() => router.back()}>
        <Text style={styles.ghostButtonText}>Go Back</Text>
      </Pressable>
    </View>
  );
}

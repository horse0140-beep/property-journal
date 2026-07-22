import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { BackLink } from "@/components/EmptyState";
import { goBackOrHome } from "@/components/WebHomeButton";
import { Card } from "@/components/Card";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { displayPlanLabel, hasFeatureAccess, isPremiumUser, type PremiumFeature } from "@/lib/premium";

type FeatureItem = {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  feature?: PremiumFeature;
  tier?: "premium" | "landlord" | "realtor";
};

const FEATURES: FeatureItem[] = [
  {
    title: "Premium Upgrade",
    subtitle: "Subscribe via RevenueCat in-app purchases",
    icon: "star",
    route: "/features/upgrade",
    tier: undefined,
  },
  {
    title: "Property Sharing",
    subtitle: "Share read-only property history with family, insurers, or partners",
    icon: "share-social-outline",
    route: "/features/sharing",
    feature: "property_sharing",
    tier: "premium",
  },
  {
    title: "Contractor Portal",
    subtitle: "Invite contractors to view maintenance and repair schedules",
    icon: "hammer-outline",
    route: "/features/contractor-portal",
    feature: "contractor_portal",
    tier: "premium",
  },
  {
    title: "Home Buyer Reports",
    subtitle: "CarFax-style reports and secure buyer share links",
    icon: "document-text-outline",
    route: "/features/buyer-reports",
    feature: "buyer_share_links",
    tier: "premium",
  },
  {
    title: "AI Maintenance Forecasting",
    subtitle: "Predict upcoming costs and maintenance priorities",
    icon: "sparkles-outline",
    route: "/features/forecast",
    feature: "ai_forecasting",
    tier: "premium",
  },
  {
    title: "Landlord Pro Dashboard",
    subtitle: "Manage rental portfolio, overdue tasks, and bulk reports",
    icon: "business-outline",
    route: "/features/landlord-dashboard",
    feature: "landlord_dashboard",
    tier: "landlord",
  },
  {
    title: "Realtor Pro Tools",
    subtitle: "Branded reports, buyer links, and client management",
    icon: "people-outline",
    route: "/features/realtor-tools",
    feature: "realtor_tools",
    tier: "realtor",
  },
  {
    title: "Stripe Billing",
    subtitle: "Manage your subscription and payment method",
    icon: "card-outline",
    route: "/features/billing",
  },
];

export default function PremiumFeaturesHub() {
  const { user, isAdmin, isOwner } = useAuth();
  const { requireFeature } = useUpgrade();
  const premium = isPremiumUser(user?.plan, isAdmin, user?.email);

  function openFeature(f: FeatureItem) {
    if (!f.feature) {
      router.push(f.route as any);
      return;
    }
    requireFeature(f.feature, () => router.push(f.route as any));
  }

  function isLocked(f: FeatureItem): boolean {
    if (!f.feature) return false;
    return !hasFeatureAccess(f.feature, user?.plan, isAdmin, user?.email);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <BackLink onPress={goBackOrHome} />

        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            padding: 20,
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
            PROPERTY JOURNAL PREMIUM
          </Text>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 6 }}>
            Premium Features
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
            Current plan: {displayPlanLabel(user?.plan, { isAdmin, email: user?.email, isOwner })}
            {premium && !isAdmin && !isOwner ? " ✓" : ""}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/settings/help")}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Help & How to Use</Text>
        </Pressable>

        {FEATURES.map((f) => {
          const locked = isLocked(f);
          return (
            <Pressable key={f.title} onPress={() => openFeature(f)}>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: colors.bgSection,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={(locked ? "lock-closed" : f.icon) as any}
                      size={24}
                      color={locked ? colors.textMuted : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.cardTitle}>{f.title}</Text>
                      {locked && f.tier ? (
                        <View
                          style={{
                            backgroundColor: colors.gold,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                            {f.tier === "landlord"
                              ? "LANDLORD"
                              : f.tier === "realtor"
                                ? "REALTOR"
                                : "PRO"}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.muted}>{f.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

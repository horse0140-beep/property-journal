import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { PremiumGate } from "@/components/PremiumGate";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";

export default function RealtorToolsScreen() {
  const { properties, getPropertyScore } = useHomeWise();
  const { user } = useAuth();

  return (
    <Screen>
      <PremiumGate
        feature="realtor_tools"
        featureName="Realtor Pro Tools"
        description="Branded home history reports, buyer share links, and client property management."
      >
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
              backgroundColor: colors.gold,
              borderRadius: 20,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800" }}>
              REALTOR PRO
            </Text>
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 6 }}>
              Client Tools
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 8 }}>
              {user?.name ?? "Realtor"}
            </Text>
          </View>

          <Card elevated>
            <Text style={styles.sectionHeader}>Pro Toolkit</Text>
            {[
              {
                title: "Buyer Share Links",
                subtitle: "Secure links for buyers to view home history",
                icon: "link-outline",
                route: "/features/buyer-reports",
              },
              {
                title: "Branded PDF Reports",
                subtitle: "Professional Home History Reports for listings",
                icon: "document-text-outline",
                route: "/(tabs)/reports",
              },
              {
                title: "Client Properties",
                subtitle: "Track multiple client homes in one place",
                icon: "business-outline",
                route: "/(tabs)/properties",
              },
            ].map((tool) => (
              <Pressable
                key={tool.title}
                onPress={() => router.push(tool.route as any)}
                style={[styles.rowBetween, { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.bgSection,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={tool.icon as any} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{tool.title}</Text>
                    <Text style={styles.muted}>{tool.subtitle}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </Card>

          <Text style={[styles.sectionHeader, { marginTop: 8 }]}>Your Listings</Text>
          {properties.length === 0 ? (
            <Card>
              <Text style={styles.muted}>Add client properties to start generating reports.</Text>
            </Card>
          ) : (
            properties.map((p) => {
              const score = getPropertyScore(p.id);
              return (
                <Card key={p.id}>
                  <Text style={styles.cardTitle}>{p.address}</Text>
                  <Text style={styles.muted}>
                    {p.city}, {p.state} · Home Health Score {score.overall}/100
                  </Text>
                </Card>
              );
            })
          )}
        </ScrollView>
      </PremiumGate>
    </Screen>
  );
}

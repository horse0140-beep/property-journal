import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { PremiumGate } from "@/components/PremiumGate";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";

export default function LandlordDashboardScreen() {
  const { properties, maintenanceItems, repairs, getPropertyScore } = useHomeWise();
  const { user } = useAuth();

  const rentals = properties.filter((p) => p.type === "rental" || p.type === "investment");
  const rentalMaint = maintenanceItems.filter((m) =>
    rentals.some((p) => p.id === m.propertyId)
  );
  const overdue = rentalMaint.filter((m) => m.status === "Overdue");
  const rentalRepairs = repairs.filter((r) =>
    rentals.some((p) => p.id === r.propertyId)
  );

  return (
    <Screen>
      <PremiumGate
        feature="landlord_dashboard"
        featureName="Landlord Pro Dashboard"
        description="Manage multiple rental properties, track tenant maintenance, and run bulk reports."
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
              backgroundColor: colors.success,
              borderRadius: 20,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800" }}>
              LANDLORD PRO
            </Text>
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 6 }}>
              Rental Portfolio
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 8 }}>
              {user?.name ?? "Landlord"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Rentals", value: rentals.length, icon: "key-outline", color: colors.success },
              { label: "Overdue", value: overdue.length, icon: "alert-circle-outline", color: colors.danger },
              { label: "Repairs", value: rentalRepairs.length, icon: "hammer-outline", color: colors.primary },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { flex: 1 }]}>
                <Ionicons name={s.icon as any} size={20} color={s.color} />
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeader}>Rental Properties</Text>
          {rentals.length === 0 ? (
            <Card>
              <Text style={styles.muted}>
                Add properties with type Rental or Investment to see them here.
              </Text>
              <Pressable
                style={[styles.secondaryButton, { marginTop: 12 }]}
                onPress={() => router.push("/(tabs)/properties")}
              >
                <Text style={styles.secondaryButtonText}>Manage Properties</Text>
              </Pressable>
            </Card>
          ) : (
            rentals.map((p) => {
              const score = getPropertyScore(p.id);
              const maint = rentalMaint.filter((m) => m.propertyId === p.id);
              return (
                <Card key={p.id}>
                  <Text style={styles.cardTitle}>{p.address}</Text>
                  <Text style={styles.muted}>
                    {p.city}, {p.state} · Score {score.overall}/100
                  </Text>
                  <Text style={[styles.muted, { marginTop: 6 }]}>
                    {maint.length} maintenance items ·{" "}
                    {maint.filter((m) => m.status === "Overdue").length} overdue
                  </Text>
                </Card>
              );
            })
          )}

          <Text style={[styles.sectionHeader, { marginTop: 8 }]}>Quick Actions</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/features/contractor-portal")}
          >
            <Ionicons name="hammer-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Contractor Portal</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { marginTop: 10 }]}
            onPress={() => router.push("/(tabs)/reports")}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Bulk Reports</Text>
          </Pressable>
        </ScrollView>
      </PremiumGate>
    </Screen>
  );
}

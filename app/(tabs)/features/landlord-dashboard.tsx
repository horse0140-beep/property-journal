import { useRef } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { PremiumGate } from "@/components/PremiumGate";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";

const webPointer =
  Platform.OS === "web" ? ({ cursor: "pointer" } as const) : null;

function SummaryCard({
  label,
  value,
  icon,
  color,
  hint,
  onPress,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${hint}`}
      style={({ pressed }) => [
        styles.statCard,
        { flex: 1 },
        webPointer,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "700", marginTop: 4 }} numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}

function PropertyAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 8,
          backgroundColor: colors.bgSection,
          borderWidth: 1,
          borderColor: colors.border,
        },
        webPointer,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export default function LandlordDashboardScreen() {
  const { properties, maintenanceItems, repairs, getPropertyScore, selectProperty } = useHomeWise();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const rentalsSectionY = useRef(0);

  const rentals = properties.filter((p) => p.type === "rental" || p.type === "investment");
  const rentalMaint = maintenanceItems.filter((m) =>
    rentals.some((p) => p.id === m.propertyId)
  );
  const overdue = rentalMaint.filter((m) => m.status === "Overdue");
  const rentalRepairs = repairs.filter((r) =>
    rentals.some((p) => p.id === r.propertyId)
  );

  function openProperty(propertyId: string, query = "") {
    selectProperty(propertyId);
    router.push(`/properties/${propertyId}${query}`);
  }

  function openPropertyMaintenance(propertyId: string) {
    openProperty(propertyId, "?section=maintenance&tab=tasks");
  }

  function openPropertyRepairs(propertyId: string) {
    openProperty(propertyId, "?section=maintenance&tab=repairs");
  }

  function openPropertyReports(propertyId: string) {
    // Reports live on the Reports tab for the selected property (no property detail section).
    selectProperty(propertyId);
    router.push("/(tabs)/reports");
  }

  function scrollToRentals() {
    scrollRef.current?.scrollTo({ y: Math.max(rentalsSectionY.current - 8, 0), animated: true });
  }

  function openOverdueSummary() {
    const overdueItem = overdue[0];
    if (overdueItem?.propertyId) {
      openPropertyMaintenance(overdueItem.propertyId);
      return;
    }
    if (rentals[0]) {
      openPropertyMaintenance(rentals[0].id);
      return;
    }
    router.push("/(tabs)/maintenance");
  }

  function openRepairsSummary() {
    const repair = rentalRepairs[0];
    if (repair?.propertyId) {
      openPropertyRepairs(repair.propertyId);
      return;
    }
    if (rentals[0]) {
      openPropertyRepairs(rentals[0].id);
      return;
    }
    router.push("/(tabs)/maintenance");
  }

  function openMaintenanceQuickAction() {
    if (rentals[0]) {
      selectProperty(rentals[0].id);
    }
    router.push("/(tabs)/maintenance");
  }

  function openRepairsQuickAction() {
    if (rentals[0]) {
      openPropertyRepairs(rentals[0].id);
      return;
    }
    router.push("/(tabs)/maintenance");
  }

  return (
    <Screen>
      <PremiumGate
        feature="landlord_dashboard"
        featureName="Landlord Pro Dashboard"
        description="Manage multiple rental properties, track tenant maintenance, and run bulk reports."
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 },
              webPointer,
              pressed && { opacity: 0.7 },
            ]}
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
            <SummaryCard
              label="Rentals"
              value={rentals.length}
              icon="key-outline"
              color={colors.success}
              hint="View list"
              onPress={scrollToRentals}
            />
            <SummaryCard
              label="Overdue"
              value={overdue.length}
              icon="alert-circle-outline"
              color={colors.danger}
              hint="Open tasks"
              onPress={openOverdueSummary}
            />
            <SummaryCard
              label="Repairs"
              value={rentalRepairs.length}
              icon="hammer-outline"
              color={colors.primary}
              hint="Open repairs"
              onPress={openRepairsSummary}
            />
          </View>

          <View
            onLayout={(e) => {
              rentalsSectionY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.sectionHeader}>Rental Properties</Text>
          </View>

          {rentals.length === 0 ? (
            <Card>
              <Text style={styles.muted}>
                Add properties with type Rental or Investment to see them here.
              </Text>
              <Pressable
                style={[styles.secondaryButton, { marginTop: 12 }, webPointer]}
                onPress={() => router.push("/(tabs)/properties")}
                accessibilityRole="button"
                accessibilityLabel="Manage Properties"
              >
                <Text style={styles.secondaryButtonText}>Manage Properties</Text>
              </Pressable>
            </Card>
          ) : (
            rentals.map((p) => {
              const score = getPropertyScore(p.id);
              const maint = rentalMaint.filter((m) => m.propertyId === p.id);
              const overdueCount = maint.filter((m) => m.status === "Overdue").length;
              const repairCount = rentalRepairs.filter((r) => r.propertyId === p.id).length;

              return (
                <Card key={p.id} style={{ marginBottom: 4 }}>
                  <Pressable
                    onPress={() => openProperty(p.id)}
                    accessibilityRole="link"
                    accessibilityLabel={`View property ${p.address}`}
                    accessibilityHint="Opens property details"
                    style={({ pressed }) => [webPointer, pressed && { opacity: 0.92 }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{p.address}</Text>
                        <Text style={styles.muted}>
                          {p.city}, {p.state}
                        </Text>
                        <Text style={[styles.muted, { marginTop: 6 }]}>
                          Score {score.overall}/100 · {maint.length} maintenance · {overdueCount} overdue · {repairCount} repairs
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                    </View>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 10 }}>
                      View Property
                    </Text>
                  </Pressable>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    <PropertyAction label="Maintenance" onPress={() => openPropertyMaintenance(p.id)} />
                    <PropertyAction label="Repairs" onPress={() => openPropertyRepairs(p.id)} />
                    <PropertyAction label="Reports" onPress={() => openPropertyReports(p.id)} />
                  </View>
                </Card>
              );
            })
          )}

          <Text style={[styles.sectionHeader, { marginTop: 8 }]}>Quick Actions</Text>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, webPointer, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/features/contractor-portal")}
            accessibilityRole="button"
            accessibilityLabel="Contractor Portal"
          >
            <Ionicons name="hammer-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Contractor Portal</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { marginTop: 10 }, webPointer, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(tabs)/reports")}
            accessibilityRole="button"
            accessibilityLabel="Bulk Reports"
          >
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Reports</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { marginTop: 10 }, webPointer, pressed && { opacity: 0.85 }]}
            onPress={openMaintenanceQuickAction}
            accessibilityRole="button"
            accessibilityLabel="Maintenance"
          >
            <Ionicons name="construct-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Maintenance</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { marginTop: 10 }, webPointer, pressed && { opacity: 0.85 }]}
            onPress={openRepairsQuickAction}
            accessibilityRole="button"
            accessibilityLabel="Repairs"
          >
            <Ionicons name="build-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Repairs</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, { marginTop: 10 }, webPointer, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(tabs)/properties")}
            accessibilityRole="button"
            accessibilityLabel="Properties"
          >
            <Ionicons name="business-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Properties</Text>
          </Pressable>
        </ScrollView>
      </PremiumGate>
    </Screen>
  );
}

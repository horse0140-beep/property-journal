import { ScrollView, Text, View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingView } from "@/components/LoadingView";
import { ErrorCard } from "@/components/ErrorCard";
import { colors, styles } from "@/constants/theme";
import { useTabScrollContentStyle } from "@/constants/layout";
import { useHomeWise } from "@/context/HomeWiseContext";
import { TabScreenHeader } from "@/components/TabScreenHeader";
import { matchesPropertyId } from "@/types/database";

function statusBadge(status: string) {
  if (status === "Overdue") return styles.badgeDanger;
  if (status === "Due Soon") return styles.badgeWarn;
  if (status === "Completed") return styles.badge;
  return styles.badgeInfo;
}

export default function MaintenanceScreen() {
  const {
    selectedProperty,
    maintenanceItems,
    repairs,
    appliances,
    isLoading,
    loadError,
    refreshData,
  } = useHomeWise();
  const tabScrollStyle = useTabScrollContentStyle();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const pid = selectedProperty?.id ?? "";

  // Score "Fix Now" actions navigate here with a tab param — forward it to the
  // property record, which has the actual editors for that sub-tab.
  useEffect(() => {
    if (!tabParam || !pid || isLoading) return;
    router.setParams({ tab: "" });
    router.push(`/properties/${pid}?section=maintenance&tab=${tabParam}`);
  }, [tabParam, pid, isLoading]);
  const propMaintenance = maintenanceItems.filter((m) => matchesPropertyId(m.propertyId, pid));
  const propRepairs = repairs.filter((r) => matchesPropertyId(r.propertyId, pid));
  const propAppliances = appliances.filter((a) => matchesPropertyId(a.propertyId, pid));

  if (isLoading) {
    return (
      <Screen noPad tabScreen>
        <LoadingView message="Loading maintenance data…" />
      </Screen>
    );
  }

  if (!selectedProperty) {
    return (
      <Screen noPad tabScreen>
        <EmptyState
          icon="construct-outline"
          title="No property selected"
          message="Open a property to view and manage its maintenance history."
          actionLabel="Go to Properties"
          onAction={() => router.push("/(tabs)/properties")}
          compact
        />
      </Screen>
    );
  }

  return (
    <Screen noPad tabScreen>
      <TabScreenHeader>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tabHeaderTitle}>Maintenance</Text>
            <Text style={styles.tabHeaderSubtitle} numberOfLines={2}>
              {selectedProperty.address}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/properties/${pid}?section=maintenance`)}
            style={[styles.secondaryButton, { marginTop: 0, paddingVertical: 9, paddingHorizontal: 12 }]}
          >
            <Text style={styles.secondaryButtonText}>Manage</Text>
          </Pressable>
        </View>
      </TabScreenHeader>

      <ScrollView contentContainerStyle={tabScrollStyle}>
        {loadError ? <ErrorCard message={loadError} onRetry={refreshData} /> : null}
        <View style={{ height: 12 }} />

        <Text style={[styles.sectionHeader, { marginBottom: 10 }]}>Upcoming Tasks</Text>
        {propMaintenance.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>
              No tasks yet. Add tasks from your property record.
            </Text>
          </Card>
        ) : (
          propMaintenance.map((item) => (
            <Card key={item.id} style={{ marginBottom: 10 }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.muted}>Due {item.nextDue || "—"}</Text>
                </View>
                <Text style={statusBadge(item.status)}>{item.status}</Text>
              </View>
            </Card>
          ))
        )}

        <Text style={[styles.sectionHeader, { marginTop: 20, marginBottom: 10 }]}>Appliances</Text>
        {propAppliances.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>No appliances logged yet.</Text>
          </Card>
        ) : (
          propAppliances.slice(0, 6).map((a) => (
            <Card key={a.id} style={{ marginBottom: 10 }}>
              <Text style={styles.cardTitle}>{a.name}</Text>
              <Text style={styles.muted}>{[a.brand, a.model].filter(Boolean).join(" · ") || a.condition}</Text>
            </Card>
          ))
        )}

        <Text style={[styles.sectionHeader, { marginTop: 20, marginBottom: 10 }]}>Recent Repairs</Text>
        {propRepairs.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>No repairs logged yet.</Text>
          </Card>
        ) : (
          propRepairs.slice(0, 8).map((r) => (
            <Card key={r.id} style={{ marginBottom: 10 }}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.muted}>{r.date} · ${r.cost}</Text>
            </Card>
          ))
        )}

        <Pressable
          onPress={() => router.push(`/properties/${pid}?section=maintenance&tab=appliances`)}
          style={[styles.secondaryButton, { marginTop: 12 }]}
        >
          <Text style={styles.secondaryButtonText}>Manage Appliances</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push(`/properties/${pid}?section=maintenance`)}
          style={[styles.primaryButton, { marginTop: 16 }]}
        >
          <Ionicons name="home-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Open Property Record</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

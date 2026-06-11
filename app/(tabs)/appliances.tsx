import { useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";

export default function AppliancesScreen() {
  const {
    selectedProperty,
    appliances,
    isLoading,
    loadError,
    refreshData,
    deleteAppliance,
  } = useHomeWise();

  useEffect(() => {
    if (loadError) {
      Alert.alert("Load Error", loadError);
    }
  }, [loadError]);

  const pid = selectedProperty?.id ?? "";
  const list = appliances.filter((a) => a.propertyId === pid);

  if (isLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.muted, { marginTop: 12 }]}>Loading appliances…</Text>
        </View>
      </Screen>
    );
  }

  if (!selectedProperty) {
    return (
      <Screen>
        <View style={{ flex: 1, padding: 24 }}>
          <EmptyState
            icon="hardware-chip-outline"
            title="No property selected"
            message="Add or select a property to manage appliances."
          />
          <Pressable style={styles.primaryButton} onPress={() => router.push("/(tabs)/properties")}>
            <Text style={styles.primaryButtonText}>Go to Properties</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen noPad tabScreen>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          backgroundColor: colors.bgCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={styles.screenTitle}>Appliances</Text>
        <Text style={styles.screenSubtitle}>{selectedProperty.address}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}>
        <Pressable
          style={[styles.primaryButton, { marginBottom: 16 }]}
          onPress={() => router.push("/(tabs)/maintenance")}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Add Appliance (Maintain tab)</Text>
        </Pressable>

        {list.length === 0 ? (
          <EmptyState
            icon="hardware-chip-outline"
            title="No appliances yet"
            message="Track HVAC, water heater, appliances and their warranties from the Maintain tab."
          />
        ) : (
          list.map((a) => (
            <Card key={a.id}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{a.name}</Text>
                <Text
                  style={{
                    color:
                      a.condition === "Poor" || a.condition === "Replace Soon"
                        ? colors.danger
                        : colors.success,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {a.condition}
                </Text>
              </View>
              <Text style={styles.muted}>
                {a.brand} {a.model}
              </Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>
                Installed {a.installDate || "—"} · Warranty {a.warrantyExpires || "—"}
              </Text>
              <Pressable
                onPress={() =>
                  Alert.alert("Delete Appliance", `Remove ${a.name}?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteAppliance(a.id) },
                  ])
                }
                style={{ marginTop: 10 }}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

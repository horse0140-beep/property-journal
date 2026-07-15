import { useCallback, useState } from "react";
import {
  ScrollView, Text, View, Pressable, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { PremiumGate } from "@/components/PremiumGate";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useHomeWise } from "@/context/HomeWiseContext";
import { fetchMaintenanceForecast, generateMaintenanceForecast } from "@/services/forecastService";
import type { MaintenanceForecast } from "@/types/premium";

function priorityVariant(p: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (p === "high") return "danger";
  if (p === "medium") return "warning";
  return "muted";
}

export default function MaintenanceForecastScreen() {
  const { user } = useAuth();
  const { selectedProperty, maintenanceItems, repairs, appliances, getPropertyScore } = useHomeWise();
  const [forecast, setForecast] = useState<MaintenanceForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !selectedProperty) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMaintenanceForecast(user.id, selectedProperty.id);
      setForecast(data);
    } catch {
      setForecast(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedProperty?.id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function handleGenerate() {
    if (!user?.id || !selectedProperty) return;
    setGenerating(true);
    try {
      const pid = selectedProperty.id;
      const result = await generateMaintenanceForecast(user.id, pid, {
        propertyLabel: selectedProperty.address,
        yearBuilt: selectedProperty.yearBuilt,
        maintenance: maintenanceItems.filter((m) => m.propertyId === pid),
        repairs: repairs.filter((r) => r.propertyId === pid),
        appliances: appliances.filter((a) => a.propertyId === pid),
        score: getPropertyScore(pid).overall,
      });
      setForecast(result);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Screen noPad>
      <PremiumGate
        feature="ai_forecasting"
        featureName="AI Maintenance Forecasting"
        description="Get AI-powered predictions of upcoming maintenance, replacement costs, and annual budget estimates."
      >
        <AdminHeader
          title="AI Forecast"
          subtitle={selectedProperty?.address ?? "Select a property"}
          backTo="/features"
        />

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {!forecast ? (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles" size={52} color={colors.primary} />
                <Text style={styles.emptyStateTitle}>No forecast yet</Text>
                <Text style={styles.emptyStateText}>
                  AI analyzes your maintenance schedule, appliance ages, and repair history to predict what&apos;s coming in the next 12 months.
                </Text>
                <Pressable style={styles.primaryButton} onPress={handleGenerate} disabled={generating}>
                  {generating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>Generate Forecast</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <>
                <Card elevated>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <Ionicons name="sparkles" size={28} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>12-Month Forecast</Text>
                      <Text style={styles.muted}>
                        Generated {new Date(forecast.generated_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bodyText}>{forecast.summary}</Text>
                  <View style={{ marginTop: 16, backgroundColor: colors.bgSection, borderRadius: 12, padding: 14 }}>
                    <Text style={styles.label}>Estimated Annual Budget</Text>
                    <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>
                      {forecast.annual_budget}
                    </Text>
                  </View>
                </Card>

                <Text style={styles.sectionHeader}>Predicted Items ({forecast.items.length})</Text>
                {forecast.items.map((item, i) => (
                  <Card key={`${item.title}-${i}`}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.cardTitle, { flex: 1, marginRight: 8 }]}>{item.title}</Text>
                      <AdminBadge label={item.priority} variant={priorityVariant(item.priority)} />
                    </View>
                    <Text style={styles.muted}>{item.category} · Due: {item.dueWindow}</Text>
                    <Text style={[styles.bodyText, { marginTop: 8 }]}>{item.reason}</Text>
                    <Text style={{ color: colors.primary, fontWeight: "800", marginTop: 8 }}>
                      Est. {item.estimatedCost}
                    </Text>
                  </Card>
                ))}

                <Pressable
                  style={[styles.secondaryButton, generating && { opacity: 0.7 }]}
                  onPress={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                      <Text style={styles.secondaryButtonText}>Refresh Forecast</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        )}
      </PremiumGate>
    </Screen>
  );
}

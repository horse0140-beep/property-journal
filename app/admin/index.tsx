import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminStats } from "@/services/adminService";
import type { AdminStats } from "@/types/admin";

const NAV_ITEMS = [
  { title: "Users", subtitle: "Search, edit plans & roles", icon: "people-outline", route: "/admin/users", metricKey: "totalUsers" as const },
  { title: "Pricing", subtitle: "Edit subscription plan prices", icon: "pricetag-outline", route: "/admin/pricing" },
  { title: "Promo Codes", subtitle: "Create & manage discounts", icon: "ticket-outline", route: "/admin/promo-codes", metricKey: "activePromoCodes" as const },
  { title: "Subscriptions", subtitle: "View billing & status", icon: "card-outline", route: "/admin/subscriptions", metricKey: "activeSubscriptions" as const },
  { title: "Support Tickets", subtitle: "Respond to user requests", icon: "chatbubble-ellipses-outline", route: "/admin/support", metricKey: "openTickets" as const },
  { title: "Reports", subtitle: "Business metrics & insights", icon: "bar-chart-outline", route: "/admin/reports" },
] as const;

function MetricPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: "47%", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: color ?? "#fff", fontSize: 26, fontWeight: "900", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setStats(await fetchAdminStats());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  function metricFor(key?: "totalUsers" | "activePromoCodes" | "activeSubscriptions" | "openTickets") {
    if (!key || !stats) return null;
    return stats[key];
  }

  return (
    <AdminGate>
      <Screen>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={{ backgroundColor: colors.primary, borderRadius: 24, padding: 22, marginBottom: 18 }}>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }}>
              HOMEWISE ADMIN
            </Text>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 6 }}>Dashboard</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 8, fontSize: 14 }}>
              {user?.email}
            </Text>

            {loading && !stats ? (
              <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
            ) : stats ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                <MetricPill label="Users" value={stats.totalUsers} />
                <MetricPill label="Active Subs" value={stats.activeSubscriptions} color={colors.successBg} />
                <MetricPill label="Open Tickets" value={stats.openTickets} color={colors.warningBg} />
                <MetricPill label="MRR Est." value={`$${stats.totalRevenue.toFixed(0)}`} color={colors.gold} />
              </View>
            ) : null}
          </View>

          {error ? <AdminErrorCard message={error} onRetry={load} /> : null}

          <Text style={[styles.sectionHeader, { marginBottom: 12 }]}>Manage</Text>

          {NAV_ITEMS.map((item) => {
            const count = "metricKey" in item ? metricFor(item.metricKey) : null;
            return (
              <Pressable key={item.title} onPress={() => router.push(item.route as any)}>
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 14,
                        backgroundColor: colors.bgSection,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={item.icon as any} size={24} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        {count != null && (
                          <View
                            style={{
                              backgroundColor: colors.primary,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{count}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.muted}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                </Card>
              </Pressable>
            );
          })}

          {stats && (
            <Card style={{ marginTop: 4 }}>
              <Text style={styles.sectionHeader}>Plan Breakdown</Text>
              {(["free", "premium", "landlord", "realtor"] as const).map((plan) => (
                <View key={plan} style={[styles.rowBetween, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "700", textTransform: "capitalize" }}>{plan}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "800" }}>{stats.usersByPlan[plan]}</Text>
                </View>
              ))}
            </Card>
          )}

          <Pressable
            onPress={() => router.replace("/(tabs)/profile")}
            style={[styles.secondaryButton, { marginTop: 12 }]}
          >
            <Ionicons name="arrow-back-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Back to App</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    </AdminGate>
  );
}

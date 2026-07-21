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
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { getAdminDashboardStats } from "@/services/adminService";
import type { AdminDashboardStats } from "@/types/admin";

const NAV_ITEMS = [
  {
    title: "Broadcast",
    subtitle: "Send push notifications to all users",
    icon: "megaphone-outline",
    route: "/admin/broadcast",
  },
  {
    title: "Launch Readiness",
    subtitle: "Pre-launch checklist — core app, payments, legal & EAS builds",
    icon: "rocket-outline",
    route: "/admin/launch-readiness",
  },
  {
    title: "Pricing Management",
    subtitle: "Edit monthly & yearly subscription prices",
    icon: "pricetag-outline",
    route: "/admin/pricing",
  },
  {
    title: "Promo Codes",
    subtitle: "Create, disable & manage discount codes",
    icon: "ticket-outline",
    route: "/admin/promo-codes",
    metricKey: "activePromoCodes" as const,
  },
  {
    title: "User Management",
    subtitle: "Grant or revoke access & roles",
    icon: "people-outline",
    route: "/admin/users",
    metricKey: "totalUsers" as const,
  },
  {
    title: "Subscriptions",
    subtitle: "View billing status & manage subscriptions",
    icon: "card-outline",
    route: "/admin/subscriptions",
    metricKey: "activeSubscriptions" as const,
  },
  {
    title: "Reports",
    subtitle: "Business metrics, revenue & insights",
    icon: "bar-chart-outline",
    route: "/admin/reports",
  },
  {
    title: "Support Tickets",
    subtitle: "Respond to user support requests",
    icon: "chatbubble-ellipses-outline",
    route: "/admin/support",
    metricKey: "openTickets" as const,
  },
] as const;

function MetricPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "30%",
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.5,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: color ?? "#fff",
          fontSize: 22,
          fontWeight: "900",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function OwnerDashboard() {
  const { user, isOwner } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setStats(await getAdminDashboardStats());
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

  function metricFor(
    key?: "totalUsers" | "activePromoCodes" | "activeSubscriptions" | "openTickets"
  ) {
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
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: 24,
              padding: 22,
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: 11,
                fontWeight: "900",
                letterSpacing: 1.2,
              }}
            >
              PROPERTY JOURNAL OWNER
            </Text>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 6 }}>
              Owner Dashboard
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 8, fontSize: 14 }}>
              {user?.email}
            </Text>
            {isOwner && (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: colors.gold,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  marginTop: 10,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }}>
                  OWNER ACCESS / SUPER ADMIN
                </Text>
              </View>
            )}

            {loading && !stats ? (
              <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
            ) : stats ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                <MetricPill label="Total Users" value={stats.totalUsers} />
                <MetricPill label="Free" value={stats.freeUsers} />
                <MetricPill label="Premium" value={stats.premiumUsers} color={colors.successBg} />
                <MetricPill label="Landlord" value={stats.landlordUsers} color={colors.gold} />
                <MetricPill label="Realtor" value={stats.realtorUsers} color="#a8d4ff" />
                <MetricPill
                  label="Owner Access"
                  value={stats.ownerAccessUsers}
                  color={colors.gold}
                />
                <MetricPill
                  label="Active Promos"
                  value={stats.activePromoCodes}
                  color={colors.warningBg}
                />
                <MetricPill
                  label="MRR Est."
                  value={`$${stats.totalRevenue.toFixed(0)}`}
                  color="#fff"
                />
              </View>
            ) : null}
          </View>

          {error ? <AdminErrorCard message={error} onRetry={load} /> : null}

          <Pressable onPress={() => router.push("/admin/launch-readiness")}>
            <Card
              style={{
                marginBottom: 14,
                borderWidth: 2,
                borderColor: colors.gold,
                backgroundColor: colors.bgSection,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: colors.gold,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="rocket" size={26} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Launch Readiness</Text>
                  <Text style={styles.muted}>
                    Pre-launch checklist — core app, Supabase, payments, store assets, legal & EAS
                  </Text>
                </View>
                <AdminBadge label="Checklist" variant="warning" />
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>

          {stats && stats.pricingOverview.length > 0 && (
            <Card style={{ marginBottom: 8 }}>
              <Text style={styles.sectionHeader}>Pricing Overview</Text>
              {stats.pricingOverview.map((plan) => (
                <View
                  key={plan.plan_key}
                  style={[
                    styles.rowBetween,
                    {
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: "700",
                        textTransform: "capitalize",
                      }}
                    >
                      {plan.name}
                    </Text>
                    <Text style={styles.muted}>
                      ${plan.monthly_price.toFixed(2)}/mo · ${plan.yearly_price.toFixed(2)}/yr
                    </Text>
                  </View>
                  <AdminBadge
                    label={plan.is_active ? "Active" : "Inactive"}
                    variant={plan.is_active ? "success" : "muted"}
                  />
                </View>
              ))}
              <Pressable
                onPress={() => router.push("/admin/pricing")}
                style={[styles.secondaryButton, { marginTop: 12 }]}
              >
                <Text style={styles.secondaryButtonText}>Manage Pricing</Text>
              </Pressable>
            </Card>
          )}

          <Text style={[styles.sectionHeader, { marginBottom: 12 }]}>Quick Links</Text>

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
                            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                              {count}
                            </Text>
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
                <View
                  key={plan}
                  style={[
                    styles.rowBetween,
                    {
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: "700",
                      textTransform: "capitalize",
                    }}
                  >
                    {plan}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: "800" }}>
                    {stats.usersByPlan[plan]}
                  </Text>
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

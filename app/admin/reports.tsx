import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { colors, styles } from "@/constants/theme";
import { fetchAdminStats } from "@/services/adminService";
import { fetchPromoCodes } from "@/services/promoService";
import { fetchSupportTickets } from "@/services/supportService";
import { fetchSubscriptions } from "@/services/subscriptionService";
import type { AdminStats } from "@/types/admin";

export default function AdminReportsScreen() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentTickets, setRecentTickets] = useState(0);
  const [recentSubs, setRecentSubs] = useState(0);
  const [topPromo, setTopPromo] = useState("");
  const [topPromoUses, setTopPromoUses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [statsData, tickets, subs, promos] = await Promise.all([
        fetchAdminStats(),
        fetchSupportTickets(),
        fetchSubscriptions(),
        fetchPromoCodes(),
      ]);

      setStats(statsData);

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      setRecentTickets(tickets.filter((t) => new Date(t.created_at).getTime() > weekAgo).length);
      setRecentSubs(subs.filter((s) => new Date(s.created_at).getTime() > weekAgo).length);

      const sorted = [...promos].sort((a, b) => b.used_count - a.used_count);
      setTopPromo(sorted[0]?.code ?? "—");
      setTopPromoUses(sorted[0]?.used_count ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const paidUsers = stats
    ? stats.usersByPlan.premium + stats.usersByPlan.landlord + stats.usersByPlan.realtor
    : 0;
  const conversionRate = stats && stats.totalUsers > 0
    ? Math.round((paidUsers / stats.totalUsers) * 100)
    : 0;

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader title="Reports" subtitle="Business metrics and activity" />

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
            }
          >
            {error ? <AdminErrorCard message={error} onRetry={load} /> : null}

            {stats && (
              <>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 20,
                    padding: 20,
                    marginBottom: 18,
                  }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
                    ESTIMATED MRR
                  </Text>
                  <Text style={{ color: "#fff", fontSize: 36, fontWeight: "900", marginTop: 4 }}>
                    ${stats.totalRevenue.toFixed(2)}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
                    {stats.activeSubscriptions} active subscriptions · {conversionRate}% paid conversion
                  </Text>
                </View>

                <Text style={styles.sectionHeader}>Overview</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                  <StatBox icon="people-outline" label="Total Users" value={stats.totalUsers} />
                  <StatBox icon="card-outline" label="Active Subs" value={stats.activeSubscriptions} color={colors.success} />
                  <StatBox icon="chatbubble-outline" label="Open Tickets" value={stats.openTickets} color={colors.warning} />
                  <StatBox icon="ticket-outline" label="Active Promos" value={stats.activePromoCodes} color={colors.gold} />
                </View>

                <Text style={styles.sectionHeader}>Users by Plan</Text>
                <Card>
                  {(["free", "premium", "landlord", "realtor"] as const).map((plan) => {
                    const count = stats.usersByPlan[plan];
                    const total = stats.totalUsers || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <View key={plan} style={{ marginBottom: 14 }}>
                        <View style={styles.rowBetween}>
                          <Text style={{ color: colors.textPrimary, fontWeight: "700", textTransform: "capitalize" }}>
                            {plan}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontWeight: "600" }}>
                            {count} ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.healthBar}>
                          <View
                            style={[
                              styles.healthBarFill,
                              { width: `${pct}%`, backgroundColor: colors.primary },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </Card>

                <Text style={styles.sectionHeader}>Last 7 Days</Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                  <StatBox icon="chatbubble-ellipses-outline" label="New Tickets" value={recentTickets} />
                  <StatBox icon="trending-up-outline" label="New Subs" value={recentSubs} />
                </View>

                <Text style={styles.sectionHeader}>Promotions</Text>
                <Card>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={styles.label}>Active Promo Codes</Text>
                      <Text style={[styles.statValue, { fontSize: 22 }]}>{stats.activePromoCodes}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.label}>Top Code</Text>
                      <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 18, marginTop: 4 }}>
                        {topPromo}
                      </Text>
                      {topPromoUses > 0 && (
                        <Text style={[styles.muted, { marginTop: 2 }]}>{topPromoUses} redemptions</Text>
                      )}
                    </View>
                  </View>
                </Card>

                <Text style={styles.sectionHeader}>Quick Insights</Text>
                <Card>
                  <View style={{ gap: 12 }}>
                    <InsightRow
                      icon="checkmark-circle-outline"
                      text={`${stats.activeSubscriptions} paying subscribers generating ~$${stats.totalRevenue.toFixed(2)}/mo`}
                    />
                    <InsightRow
                      icon="alert-circle-outline"
                      text={
                        stats.openTickets > 0
                          ? `${stats.openTickets} support tickets need attention`
                          : "All support tickets are handled"
                      }
                      color={stats.openTickets > 0 ? colors.warning : colors.success}
                    />
                    <InsightRow
                      icon="star-outline"
                      text={`${paidUsers} users on paid plans (${conversionRate}% of total)`}
                    />
                    <InsightRow
                      icon="gift-outline"
                      text={`${stats.activePromoCodes} active promotional campaigns`}
                    />
                    <InsightRow
                      icon="calendar-outline"
                      text={`${recentTickets} new tickets and ${recentSubs} new subscriptions this week`}
                    />
                  </View>
                </Card>
              </>
            )}
          </ScrollView>
        )}
      </Screen>
    </AdminGate>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <View style={[styles.statCard, { minWidth: "47%", flexGrow: 1 }]}>
      <Ionicons name={icon} size={22} color={color ?? colors.primary} />
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InsightRow({
  icon,
  text,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <Ionicons name={icon} size={20} color={color ?? colors.primary} style={{ marginTop: 1 }} />
      <Text style={[styles.bodyText, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

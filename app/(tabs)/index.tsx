import {
  ScrollView, Text, View, Pressable, Image, StyleSheet, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, styles } from "@/constants/theme";
import { TAB_SCROLL_PADDING } from "@/constants/layout";
import { LoadingView } from "@/components/LoadingView";
import { ErrorCard } from "@/components/ErrorCard";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import type { PremiumFeature } from "@/lib/premium";
import { scheduleMaintenanceNotifications, scheduleWarrantyNotifications } from "@/lib/notifications";

// Quick actions all route to real existing screens
// "Add Repair", "Add Receipt", "Add Appliance" deep-link into the Maintenance tab
// with a flag to open the correct modal via URL params
const QUICK_ACTIONS = [
  { label: "Add Repair",      icon: "construct-outline",     route: "/(tabs)/maintenance",  color: "#EEF4FF" },
  { label: "Add Receipt",     icon: "receipt-outline",       route: "/(tabs)/vault",        color: "#F0FFF4" },
  { label: "Add Appliance",   icon: "hardware-chip-outline", route: "/(tabs)/maintenance",  color: "#FFF8EE" },
  { label: "Upload Document", icon: "folder-open-outline",   route: "/(tabs)/vault",        color: "#F0F4FF" },
  { label: "Take Photo",      icon: "camera-outline",        route: "/vault/photos",        color: "#FFF0F0" },
  { label: "Ask AI",          icon: "sparkles-outline",      route: "/ai",                  color: "#F5F0FF" },
] as const;

function QuickActionBtn({ label, icon, route, color }: (typeof QUICK_ACTIONS)[number]) {
  return (
    <Pressable
      onPress={() => router.push(route as any)}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 70,
        alignItems: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{
        width: 54, height: 54, borderRadius: 14,
        backgroundColor: color,
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: colors.border,
      }}>
        <Ionicons name={icon as any} size={24} color={colors.primary} />
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginTop: 6, textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const {
    selectedProperty,
    maintenanceItems,
    repairs,
    documents,
    photos,
    appliances,
    getPropertyScore,
    isLoading,
    loadError,
    refreshData,
  } = useHomeWise();
  const { user } = useAuth();
  const { requireFeature } = useUpgrade();
  const insets = useSafeAreaInsets();

  // Schedule notifications whenever maintenance / doc data changes
  useEffect(() => {
    if (!user?.notificationsEnabled) return;
    const pid = selectedProperty?.id;
    if (!pid) return;
    const propMaint = maintenanceItems.filter((m) => m.propertyId === pid);
    const propDocs  = documents.filter((d) => d.propertyId === pid);
    if (user.maintenanceReminders) {
      scheduleMaintenanceNotifications(propMaint).catch(() => {});
    }
    if (user.warrantyAlerts) {
      scheduleWarrantyNotifications(propDocs).catch(() => {});
    }
  }, [selectedProperty?.id, maintenanceItems.length, documents.length, user?.notificationsEnabled]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LoadingView message="Loading your home data…" />
      </View>
    );
  }

  if (!selectedProperty) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 32, paddingBottom: TAB_SCROLL_PADDING }}>
        <Ionicons name="home-outline" size={60} color={colors.textMuted} />
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800", marginTop: 16, textAlign: "center" }}>
          No property added yet
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
          Add your home to start tracking its health.
        </Text>
        <Pressable
          style={[styles.primaryButton, { marginTop: 24, paddingHorizontal: 32 }]}
          onPress={() => router.push("/(tabs)/properties")}
        >
          <Text style={styles.primaryButtonText}>Add Your Home</Text>
        </Pressable>
      </View>
    );
  }

  const score = getPropertyScore(selectedProperty.id);
  const propMaintenance = maintenanceItems.filter((m) => m.propertyId === selectedProperty.id);
  const propRepairs     = repairs.filter((r) => r.propertyId === selectedProperty.id);
  const propDocs        = documents.filter((d) => d.propertyId === selectedProperty.id);
  const propPhotos      = photos.filter((p) => p.propertyId === selectedProperty.id);

  const upcomingTasks = propMaintenance
    .filter((m) => m.status !== "Completed")
    .sort((a, b) => {
      const order = { Overdue: 0, "Due Soon": 1, Upcoming: 2, Completed: 3 };
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    })
    .slice(0, 3);

  const alerts = [
    propDocs.filter((d) => d.category === "warranty" && d.expiresDate).length > 0 && {
      icon: "shield-checkmark-outline",
      color: colors.dangerBg,
      iconColor: colors.danger,
      text: `${propDocs.filter((d) => d.category === "warranty" && d.expiresDate).length} Warranties Expiring Soon`,
      sub: "See details",
      route: "/(tabs)/vault",
    },
    appliances.filter((a) => a.propertyId === selectedProperty.id && ["Poor", "Replace Soon", "Fair"].includes(a.condition)).length > 0 && {
      icon: "warning-outline",
      color: colors.warningBg,
      iconColor: colors.warning,
      text: "Appliance Needs Attention",
      sub: "Check now",
      route: "/(tabs)/maintenance",
    },
    propMaintenance.filter((m) => m.status === "Overdue").length > 0 && {
      icon: "time-outline",
      color: colors.infoBg,
      iconColor: colors.info,
      text: `${propMaintenance.filter((m) => m.status === "Overdue").length} Overdue Maintenance Task${propMaintenance.filter((m) => m.status === "Overdue").length > 1 ? "s" : ""}`,
      sub: "View now",
      route: "/(tabs)/maintenance",
    },
  ].filter(Boolean) as any[];

  const SCORE_BREAKDOWN = [
    { label: "Maintenance", value: score.maintenance, icon: "construct-outline" },
    { label: "Appliances",  value: score.appliances,  icon: "hardware-chip-outline" },
    { label: "Repairs",     value: score.repairs,     icon: "hammer-outline" },
    { label: "Warranty",    value: score.warranty,    icon: "shield-checkmark-outline" },
    { label: "Inspections", value: score.inspections, icon: "clipboard-outline" },
  ];

  function scoreColor(v: number) {
    if (v >= 90) return colors.scoreExcellent;
    if (v >= 80) return colors.scoreGood;
    if (v >= 65) return colors.scoreFair;
    return colors.scorePoor;
  }
  function scoreLabel(v: number) {
    if (v >= 90) return "Excellent";
    if (v >= 80) return "Very Good";
    if (v >= 65) return "Good";
    return "Fair";
  }
  function statusInfo(status: string) {
    if (status === "Overdue")  return { bg: colors.dangerBg,  color: colors.danger,  icon: "alert-circle-outline" };
    if (status === "Due Soon") return { bg: colors.warningBg, color: colors.warning, icon: "time-outline" };
    return { bg: colors.infoBg, color: colors.info, icon: "calendar-outline" };
  }

  const typeLabel: Record<string, string> = {
    primary: "PRIMARY HOME", rental: "RENTAL",
    vacation: "VACATION HOME", investment: "INVESTMENT",
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 12, paddingTop: insets.top + 8,
        backgroundColor: colors.bgCard,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => router.push("/(tabs)/properties")}>
            <Ionicons name="menu" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Ionicons name="home" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900" }}>HOME</Text>
            <Text style={{ color: colors.accent, fontSize: 17, fontWeight: "900" }}>WISE</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Pressable style={{ position: "relative" }}>
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            {alerts.length > 0 && (
              <View style={{
                position: "absolute", top: -2, right: -2,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: colors.danger,
              }} />
            )}
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>
                {(user?.name ?? "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_SCROLL_PADDING }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshData} tintColor={colors.primary} />
        }
      >
        {loadError ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <ErrorCard message={loadError} onRetry={refreshData} />
          </View>
        ) : null}

        {/* ── Property hero card ───────────────────────────────── */}
        <View style={{ margin: 16, borderRadius: 20, overflow: "hidden", backgroundColor: colors.primaryDark, minHeight: 180 }}>
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,25,60,0.72)" }} />
          <View style={{ padding: 20, flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start", marginBottom: 10 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                    {typeLabel[selectedProperty.type] ?? "HOME"}
                  </Text>
                </View>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 28 }}>
                  {selectedProperty.address}
                </Text>
                <Pressable onPress={() => router.push("/(tabs)/properties")}>
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 4 }}>
                    {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}  ✏️
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
                  {[
                    { label: "Year Built", value: selectedProperty.yearBuilt || "—" },
                    { label: "Sq Ft",      value: selectedProperty.squareFeet || "—" },
                    { label: "Est. Value", value: selectedProperty.estimatedValue ? `$${selectedProperty.estimatedValue}` : "—" },
                  ].map((item) => (
                    <View key={item.label}>
                      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "700" }}>{item.label}</Text>
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Score ring */}
              <Pressable onPress={() => router.push("/(tabs)/reports")} style={{ alignItems: "center" }}>
                <View style={{
                  backgroundColor: "rgba(10,20,50,0.85)",
                  borderRadius: 16, padding: 12,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                }}>
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: "700", marginBottom: 5 }}>
                    HOME HEALTH SCORE
                  </Text>
                  <View style={{
                    width: 76, height: 76, borderRadius: 38,
                    borderWidth: 6, borderColor: scoreColor(score.overall),
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}>
                    <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900" }}>{score.overall}</Text>
                  </View>
                  <Text style={{ color: scoreColor(score.overall), fontSize: 11, fontWeight: "800", marginTop: 5 }}>
                    {score.label}
                  </Text>
                  <Text style={{ color: "rgba(96,165,250,0.9)", fontSize: 10, marginTop: 3 }}>View Details ›</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Premium features ─────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionHeader}>Premium Features</Text>
            <Pressable onPress={() => router.push("/features")}>
              <Text style={styles.viewAllText}>See All</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {([
              { label: "Upgrade", icon: "star", route: "/features/upgrade" },
              { label: "Property Sharing", icon: "share-social-outline", route: "/features/sharing", feature: "property_sharing" as PremiumFeature },
              { label: "Contractor Portal", icon: "hammer-outline", route: "/features/contractor-portal", feature: "contractor_portal" as PremiumFeature },
              { label: "Buyer Reports", icon: "document-text-outline", route: "/features/buyer-reports", feature: "buyer_share_links" as PremiumFeature },
              { label: "AI Forecast", icon: "sparkles-outline", route: "/features/forecast", feature: "ai_forecasting" as PremiumFeature },
            ] as const).map((f) => (
              <Pressable
                key={f.label}
                onPress={() =>
                  "feature" in f && f.feature
                    ? requireFeature(f.feature, () => router.push(f.route as any))
                    : router.push(f.route as any)
                }
                style={{
                  width: 130,
                  backgroundColor: colors.bgCard,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <Ionicons name={f.icon as any} size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Quick actions ────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={styles.sectionHeader}>Quick Actions</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {QUICK_ACTIONS.map((a) => (
              <QuickActionBtn key={a.label} {...a} />
            ))}
          </View>
        </View>

        {/* ── Upcoming tasks + Alerts side by side ─────────────── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 12, marginBottom: 16 }}>

          {/* Upcoming Tasks */}
          <View style={{ flex: 1 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}>UPCOMING TASKS</Text>
              <Pressable onPress={() => router.push("/(tabs)/maintenance")}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {upcomingTasks.length === 0 ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: "center" }}>All caught up!</Text>
                </View>
              ) : (
                upcomingTasks.map((task, i) => {
                  const s = statusInfo(task.status);
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => router.push("/(tabs)/maintenance")}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 8, padding: 11,
                        borderBottomWidth: i < upcomingTasks.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: s.bg, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={s.icon as any} size={14} color={s.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text style={{ color: s.color, fontSize: 10, fontWeight: "600" }}>{task.status}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                    </Pressable>
                  );
                })
              )}
              <Pressable
                onPress={() => router.push("/(tabs)/maintenance")}
                style={{ padding: 9, alignItems: "center", backgroundColor: colors.bgSection }}
              >
                <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 11 }}>
                  Full Maintenance Schedule ›
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Alerts */}
          <View style={{ flex: 1 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}>ALERTS</Text>
              <Pressable onPress={() => router.push("/(tabs)/vault")}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {alerts.length === 0 ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <Ionicons name="shield-checkmark" size={28} color={colors.success} />
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: "center" }}>No alerts</Text>
                </View>
              ) : (
                alerts.map((a: any, i: number) => (
                  <Pressable
                    key={i}
                    onPress={() => router.push(a.route)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 8, padding: 11,
                      borderBottomWidth: i < alerts.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: a.color, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={a.icon} size={14} color={a.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 12 }} numberOfLines={2}>{a.text}</Text>
                      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "600" }}>{a.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
              <Pressable
                onPress={() => router.push("/(tabs)/vault")}
                style={{ padding: 9, alignItems: "center", backgroundColor: colors.bgSection }}
              >
                <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 11 }}>
                  View All Alerts ›
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Score Breakdown ───────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionHeader}>Home Score Breakdown</Text>
            <Pressable onPress={() => router.push("/(tabs)/reports")}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>
          <View style={{
            backgroundColor: colors.bgCard, borderRadius: 14,
            borderWidth: 1, borderColor: colors.border,
            flexDirection: "row", padding: 14, justifyContent: "space-between",
          }}>
            {SCORE_BREAKDOWN.map((s) => (
              <View key={s.label} style={{ alignItems: "center", flex: 1 }}>
                <Ionicons name={s.icon as any} size={16} color={colors.textMuted} />
                <Text style={{ color: scoreColor(s.value), fontSize: 20, fontWeight: "900", marginTop: 3 }}>{s.value}</Text>
                <Text style={{ color: scoreColor(s.value), fontSize: 9, fontWeight: "700" }}>{scoreLabel(s.value)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 1, textAlign: "center" }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Recent Repairs + Documents ────────────────────────── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 12, marginBottom: 16 }}>

          <View style={{ flex: 1 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12 }}>RECENT REPAIRS</Text>
              <Pressable onPress={() => router.push("/(tabs)/maintenance")}><Text style={styles.viewAllText}>All</Text></Pressable>
            </View>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
              {propRepairs.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", padding: 12 }}>None yet</Text>
              ) : (
                propRepairs.slice(0, 3).map((r) => (
                  <View key={r.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="hammer-outline" size={15} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>{r.title}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>{r.date} · ${r.cost}</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: colors.successBg, alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3, marginLeft: 40 }}>
                      <Text style={{ color: colors.success, fontWeight: "700", fontSize: 9 }}>Completed</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12 }}>RECENT DOCS</Text>
              <Pressable onPress={() => router.push("/(tabs)/vault")}><Text style={styles.viewAllText}>All</Text></Pressable>
            </View>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
              {propDocs.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", padding: 12 }}>None yet</Text>
              ) : (
                propDocs.slice(0, 3).map((d) => (
                  <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="document" size={15} color={colors.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 12 }} numberOfLines={1}>{d.title}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{d.uploadDate}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        {/* ── Recent Photos ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionHeader}>Recent Photos</Text>
            <Pressable onPress={() => router.push("/vault/photos")}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>
          {propPhotos.length === 0 ? (
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: "center" }}>
              <Ionicons name="images-outline" size={32} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>No photos yet</Text>
              <Pressable onPress={() => router.push("/vault/photos")}
                style={{ marginTop: 10, backgroundColor: colors.bgSection, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Add Photo</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {propPhotos.slice(0, 8).map((p) => (
                  <Pressable key={p.id} onPress={() => router.push("/vault/photos")}>
                    <Image
                      source={{ uri: p.uri }}
                      style={{ width: 90, height: 90, borderRadius: 12 }}
                    />
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => router.push("/vault/photos")}
                  style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: colors.bgSection, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="add" size={24} color={colors.textMuted} />
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

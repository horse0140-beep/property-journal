import {
  ScrollView, Text, View, Pressable, StyleSheet, RefreshControl, Modal, Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, styles } from "@/constants/theme";
import { useTabScrollContentStyle } from "@/constants/layout";
import { LoadingView } from "@/components/LoadingView";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCard } from "@/components/ErrorCard";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import type { PremiumFeature } from "@/lib/premium";
import { PhotoCard } from "@/components/PhotoCard";
import {
  parseDueDate,
  scheduleMaintenanceNotifications,
  scheduleWarrantyNotifications,
} from "@/lib/notifications";

function setupDoneKey(userId: string) {
  return `HOMEWISE_SETUP_DONE_V1:${userId}`;
}

const QUICK_ACTIONS = [
  { label: "Property Record", icon: "home-outline", section: "overview", color: "#EEF4FF" },
  { label: "Maintenance", icon: "construct-outline", section: "maintenance", color: "#FFF8EE" },
  { label: "Documents", icon: "folder-open-outline", section: "documents", color: "#F0F4FF" },
  { label: "Property Photos", icon: "camera-outline", section: "photos", color: "#FFF0F0" },
  { label: "Ask AI", icon: "sparkles-outline", route: "/ai", color: "#F5F0FF" },
] as const;

function QuickActionBtn({
  label,
  icon,
  section,
  tab,
  route,
  color,
  propertyId,
}: {
  label: string;
  icon: string;
  section?: string;
  tab?: string;
  route?: string;
  color: string;
  propertyId?: string;
}) {
  function onPress() {
    if (route) {
      router.push(route as "/ai");
      return;
    }
    if (!propertyId) {
      router.push("/(tabs)/properties");
      return;
    }
    if (section) {
      const query = tab ? `?section=${section}&tab=${tab}` : `?section=${section}`;
      router.push(`/properties/${propertyId}${query}`);
      return;
    }
    router.push(`/properties/${propertyId}`);
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: "32%",
        alignItems: "center",
        marginBottom: 14,
        opacity: pressed ? 0.75 : 1,
        minHeight: 88,
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
      <Text
        style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginTop: 6, textAlign: "center" }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const {
    properties,
    selectedProperty,
    selectProperty,
    maintenanceItems,
    repairs,
    documents,
    photos,
    appliances,
    getPropertyScore,
    isLoading,
    loadError,
    refreshData,
    updatePhoto,
    deletePhoto,
  } = useHomeWise();
  const { user, isAdmin, isOwner } = useAuth();
  const { requireFeature } = useUpgrade();
  const insets = useSafeAreaInsets();
  const tabScrollStyle = useTabScrollContentStyle();
  const [refreshing, setRefreshing] = useState(false);
  const [propertyPickerOpen, setPropertyPickerOpen] = useState(false);
  const [setupHidden, setSetupHidden] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setSetupHidden(true);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(setupDoneKey(user.id)).then((v) => {
      if (!cancelled) setSetupHidden(v === "1");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Content signatures so edits (not just adds/deletes) reschedule reminders.
  const maintenanceSignature = useMemo(
    () => maintenanceItems.map((m) => `${m.id}|${m.nextDue}|${m.status}`).join(","),
    [maintenanceItems]
  );
  const documentSignature = useMemo(
    () => documents.map((d) => `${d.id}|${d.expiresDate ?? ""}`).join(","),
    [documents]
  );

  const setupChecks = useMemo(() => {
    const pid = selectedProperty?.id;
    return {
      property: properties.length > 0,
      maintenance: pid
        ? maintenanceItems.some((m) => m.propertyId === pid)
        : maintenanceItems.length > 0,
      document: pid
        ? documents.some((d) => d.propertyId === pid)
        : documents.length > 0,
      photo: pid ? photos.some((p) => p.propertyId === pid) : photos.length > 0,
    };
  }, [
    properties.length,
    selectedProperty?.id,
    maintenanceItems,
    documents,
    photos,
  ]);
  const setupAllDone =
    setupChecks.property && setupChecks.maintenance && setupChecks.document && setupChecks.photo;

  useEffect(() => {
    if (!user?.id || !setupAllDone || setupHidden) return;
    void AsyncStorage.setItem(setupDoneKey(user.id), "1").then(() => setSetupHidden(true));
  }, [user?.id, setupAllDone, setupHidden]);

  const showSetupChecklist = Boolean(selectedProperty) && !setupHidden && !setupAllDone;

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
    // Signatures stand in for the arrays; filtering happens inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedProperty?.id,
    maintenanceSignature,
    documentSignature,
    user?.notificationsEnabled,
    user?.maintenanceReminders,
    user?.warrantyAlerts,
  ]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LoadingView message="Loading your home data…" />
      </View>
    );
  }

  if (!selectedProperty) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {isOwner ? (
          <Pressable
            onPress={() => router.push("/admin")}
            style={{
              margin: 16,
              backgroundColor: colors.primary,
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Ionicons name="shield-checkmark" size={22} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Admin Dashboard</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
                Manage users, pricing, promo codes & more
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : null}
        <EmptyState
          icon="home-outline"
          title="No property added yet"
          message="Add your home to start tracking maintenance, documents, and your Home Health Score."
          actionLabel="Add Your Home"
          onAction={() => router.push("/(tabs)/properties")}
          compact
        />
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

  const propertyId = selectedProperty.id;
  // Only warranties actually expiring within 60 days count as "expiring soon".
  const expiringWarranties = propDocs.filter((d) => {
    if (d.category !== "warranty" || !d.expiresDate) return false;
    const expiry = parseDueDate(d.expiresDate);
    if (!expiry) return false;
    const days = (expiry.getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 60;
  });
  const overdueTasks = propMaintenance.filter((m) => m.status === "Overdue");
  const attentionAppliances = appliances.filter(
    (a) => a.propertyId === propertyId && ["Poor", "Replace Soon", "Fair"].includes(a.condition)
  );
  const alerts = [
    expiringWarranties[0] && {
      icon: "shield-checkmark-outline",
      color: colors.dangerBg,
      iconColor: colors.danger,
      text: `${expiringWarranties.length} Warrant${expiringWarranties.length > 1 ? "ies" : "y"} Expiring Soon`,
      sub: "See details",
      route: `/properties/${propertyId}?section=documents&docId=${expiringWarranties[0].id}`,
    },
    attentionAppliances[0] && {
      icon: "warning-outline",
      color: colors.warningBg,
      iconColor: colors.warning,
      text: "Appliance Needs Attention",
      sub: "Check now",
      route: `/properties/${propertyId}?section=maintenance&tab=appliances&applianceId=${attentionAppliances[0].id}`,
    },
    overdueTasks[0] && {
      icon: "time-outline",
      color: colors.infoBg,
      iconColor: colors.info,
      text: `${overdueTasks.length} Overdue Maintenance Task${overdueTasks.length > 1 ? "s" : ""}`,
      sub: "View now",
      route: `/properties/${propertyId}?section=maintenance&taskId=${overdueTasks[0].id}`,
    },
  ].filter(Boolean) as { icon: string; color: string; iconColor: string; text: string; sub: string; route: string }[];

  const SCORE_BREAKDOWN: { label: string; value: number; icon: string; category: string }[] = [
    { label: "Maintenance", value: score.maintenance, icon: "construct-outline", category: "maintenance" },
    { label: "Appliances", value: score.appliances, icon: "hardware-chip-outline", category: "appliances" },
    { label: "Repairs", value: score.repairs, icon: "hammer-outline", category: "exterior" },
    { label: "Warranty", value: score.warranty, icon: "shield-checkmark-outline", category: "warranty" },
    { label: "Inspections", value: score.inspections, icon: "clipboard-outline", category: "documents" },
  ];

  const webPointer = Platform.OS === "web" ? ({ cursor: "pointer" } as const) : null;

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
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "900" }}>Property</Text>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "900" }}> Journal</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          {isAdmin ? (
            <Pressable
              onPress={() => router.push("/admin")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.bgSection,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "800" }}>Admin</Text>
            </Pressable>
          ) : null}
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
        contentContainerStyle={tabScrollStyle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refreshData();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.primary}
          />
        }
      >
        {loadError ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <ErrorCard message={loadError} onRetry={refreshData} />
          </View>
        ) : null}

        {isOwner ? (
          <Pressable
            onPress={() => router.push("/admin")}
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              marginBottom: 0,
              backgroundColor: colors.primary,
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Admin Dashboard</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
                Promo codes, pricing, users, subscriptions, support & reports
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : null}

        {/* ── Active property selector ─────────────────────────── */}
        <Pressable
          onPress={() => setPropertyPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Property selector — tap to switch"
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 4,
            backgroundColor: colors.bgCard,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 14,
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            PROPERTY SELECTOR
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>
            Current Property
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
              <Ionicons name="home" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "800" }} numberOfLines={1}>
                🏠 {selectedProperty.nickname || selectedProperty.address}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                {[selectedProperty.address, selectedProperty.city, selectedProperty.state]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: 6 }}>
                Tap to switch
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.primary} />
          </View>
        </Pressable>

        {/* ── Home Setup checklist (auto-hides when complete) ─── */}
        {showSetupChecklist ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 12,
              backgroundColor: colors.bgCard,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 4 }}>
              Home Setup
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
              A few steps using tools you already have in Property Journal.
            </Text>
            {(
              [
                {
                  key: "property",
                  label: "Property Added",
                  done: setupChecks.property,
                  onPress: () => router.push("/(tabs)/properties"),
                },
                {
                  key: "maintenance",
                  label: "Add First Maintenance Task",
                  done: setupChecks.maintenance,
                  onPress: () =>
                    router.push(`/properties/${selectedProperty.id}?section=maintenance&tab=tasks`),
                },
                {
                  key: "document",
                  label: "Upload First Document",
                  done: setupChecks.document,
                  onPress: () =>
                    router.push(`/properties/${selectedProperty.id}?section=documents`),
                },
                {
                  key: "photo",
                  label: "Add First Property Photo",
                  done: setupChecks.photo,
                  onPress: () =>
                    router.push(`/properties/${selectedProperty.id}?section=photos`),
                },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.key}
                onPress={item.done ? undefined : item.onPress}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 8,
                }}
              >
                <Ionicons
                  name={item.done ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={item.done ? colors.success : colors.textMuted}
                />
                <Text
                  style={{
                    flex: 1,
                    color: item.done ? colors.textMuted : colors.textPrimary,
                    fontWeight: item.done ? "600" : "700",
                    fontSize: 14,
                    textDecorationLine: item.done ? "line-through" : "none",
                  }}
                >
                  {item.label}
                </Text>
                {!item.done ? (
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ── Quick actions (directly below current property) ─── */}
        <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
          <Text style={styles.sectionHeader}>Quick Actions</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
            Jump to this property&apos;s record, maintenance, documents, and photos.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {QUICK_ACTIONS.map((a) => (
              <QuickActionBtn key={a.label} {...a} propertyId={selectedProperty?.id} />
            ))}
          </View>
        </View>

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
                <Pressable onPress={() => router.push(`/properties/${propertyId}`)}>
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 4 }}>
                    {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip} · Open record
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

        {/* ── Upcoming tasks + Alerts (stacked to avoid overflow) ── */}
        <View style={{ paddingHorizontal: 16, gap: 16, marginBottom: 16 }}>

          {/* Upcoming Tasks */}
          <View style={{ minWidth: 0 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}>UPCOMING TASKS</Text>
              <Pressable onPress={() => router.push(`/properties/${selectedProperty.id}?section=maintenance`)}>
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
                      onPress={() =>
                        router.push(`/properties/${propertyId}?section=maintenance&taskId=${task.id}`)
                      }
                      style={({ pressed }) => [
                        {
                          flexDirection: "row", alignItems: "center", gap: 8, padding: 11,
                          borderBottomWidth: i < upcomingTasks.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        },
                        webPointer,
                        pressed && { opacity: 0.85 },
                      ]}
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
                onPress={() => router.push(`/properties/${propertyId}?section=maintenance`)}
                style={{ padding: 9, alignItems: "center", backgroundColor: colors.bgSection }}
              >
                <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 11 }}>
                  Full Maintenance Schedule ›
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Alerts */}
          <View style={{ minWidth: 0 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}>ALERTS</Text>
              <Pressable onPress={() => router.push(`/properties/${propertyId}?section=documents`)}>
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
                    key={a.route}
                    onPress={() => router.push(a.route)}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row", alignItems: "center", gap: 8, padding: 11,
                        borderBottomWidth: i < alerts.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      },
                      webPointer,
                      pressed && { opacity: 0.85 },
                    ]}
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
                onPress={() => router.push(`/properties/${propertyId}?section=documents`)}
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
              <Pressable
                key={s.label}
                onPress={() => router.push({ pathname: "/score/[category]", params: { category: s.category } })}
                style={({ pressed }) => [{ alignItems: "center", flex: 1 }, webPointer, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel={`${s.label} score ${s.value}`}
              >
                <Ionicons name={s.icon as any} size={16} color={colors.textMuted} />
                <Text style={{ color: scoreColor(s.value), fontSize: 20, fontWeight: "900", marginTop: 3 }}>{s.value}</Text>
                <Text style={{ color: scoreColor(s.value), fontSize: 9, fontWeight: "700" }}>{scoreLabel(s.value)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 1, textAlign: "center" }}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Recent Repairs + Documents (stacked) ─────────────── */}
        <View style={{ paddingHorizontal: 16, gap: 16, marginBottom: 16 }}>

          <View style={{ minWidth: 0 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12 }}>RECENT REPAIRS</Text>
              <Pressable onPress={() => router.push(`/properties/${selectedProperty.id}?section=maintenance&tab=repairs`)}><Text style={styles.viewAllText}>All</Text></Pressable>
            </View>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
              {propRepairs.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", padding: 12 }}>None yet</Text>
              ) : (
                propRepairs.slice(0, 3).map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() =>
                      router.push(`/properties/${propertyId}?section=maintenance&tab=repairs&repairId=${r.id}`)
                    }
                    style={({ pressed }) => [{ marginBottom: 10 }, webPointer, pressed && { opacity: 0.85 }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="hammer-outline" size={15} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>{r.title}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>{r.date} · ${r.cost}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    </View>
                    <View style={{ backgroundColor: colors.successBg, alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3, marginLeft: 40 }}>
                      <Text style={{ color: colors.success, fontWeight: "700", fontSize: 9 }}>Completed</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </View>

          <View style={{ minWidth: 0 }}>
            <View style={styles.sectionLabelRow}>
              <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12 }}>RECENT DOCS</Text>
              <Pressable onPress={() => router.push(`/properties/${propertyId}?section=documents`)}><Text style={styles.viewAllText}>All</Text></Pressable>
            </View>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
              {propDocs.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", padding: 12 }}>None yet</Text>
              ) : (
                propDocs.slice(0, 3).map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() =>
                      router.push(`/properties/${propertyId}?section=documents&docId=${d.id}`)
                    }
                    style={({ pressed }) => [
                      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
                      webPointer,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="document" size={15} color={colors.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 12 }} numberOfLines={1}>{d.title}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{d.uploadDate}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </View>
          </View>
        </View>

        {/* ── Recent Photos ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionHeader}>Property Photos</Text>
            <Pressable onPress={() => router.push(`/properties/${propertyId}?section=photos`)}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
            Exterior · Interior · Repairs · Projects
          </Text>
          {propPhotos.length === 0 ? (
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: "center" }}>
              <Ionicons name="images-outline" size={32} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>No property photos yet.</Text>
              <Pressable onPress={() => router.push(`/properties/${propertyId}?section=photos`)}
                style={{ marginTop: 10, backgroundColor: colors.bgSection, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Add Property Photo</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {propPhotos.slice(0, 8).map((p) => (
                  <PhotoCard
                    key={p.id}
                    photo={p}
                    size={90}
                    onUpdatePhoto={async (id, updates) => {
                      await updatePhoto(id, updates);
                      await refreshData().catch(() => undefined);
                    }}
                    onDelete={async () => {
                      await deletePhoto(p.id);
                    }}
                  />
                ))}
                <Pressable
                  onPress={() => router.push(`/properties/${propertyId}?section=photos`)}
                  style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: colors.bgSection, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="add" size={24} color={colors.textMuted} />
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>

      </ScrollView>

      <Modal
        visible={propertyPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPropertyPickerOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(15,31,61,0.45)", justifyContent: "flex-end" }}
          onPress={() => setPropertyPickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bgCard,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: insets.bottom + 16,
              maxHeight: "70%",
            }}
          >
            <View style={{ alignItems: "center", paddingVertical: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "900", paddingHorizontal: 20, marginBottom: 8 }}>
              Switch Property
            </Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {properties.map((p) => {
                const active = p.id === selectedProperty.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      selectProperty(p.id);
                      setPropertyPickerOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: active ? colors.bgSection : "transparent",
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                  >
                    <Ionicons
                      name={active ? "checkmark-circle" : "home-outline"}
                      size={22}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 15 }}>
                        {p.nickname || p.address}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                        {p.address}
                        {p.city ? ` · ${p.city}, ${p.state}` : ""}
                      </Text>
                    </View>
                    {active ? (
                      <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 11 }}>ACTIVE</Text>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  setPropertyPickerOpen(false);
                  router.push("/(tabs)/properties");
                }}
                style={[styles.primaryButton, { marginTop: 4 }]}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>+ Add Property</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

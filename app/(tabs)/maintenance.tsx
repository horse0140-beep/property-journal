import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import { formatDateForDisplay } from "@/lib/dateForDatabase";
import { matchesPropertyId } from "@/types/database";
import type { Appliance, MaintenanceItem, Repair } from "@/data/demoData";

type MaintTab = "upcoming" | "overdue" | "completed" | "appliances" | "repairs" | "all";

const TABS: { id: MaintTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
  { id: "appliances", label: "Appliances" },
  { id: "repairs", label: "Repairs" },
  { id: "all", label: "All" },
];

function statusBadge(status: string) {
  if (status === "Overdue") return styles.badgeDanger;
  if (status === "Due Soon") return styles.badgeWarn;
  if (status === "Completed") return styles.badge;
  return styles.badgeInfo;
}

function webPointer(pressed?: boolean) {
  return Platform.OS === "web"
    ? ({ cursor: "pointer" as const, opacity: pressed ? 0.85 : 1 })
    : pressed
      ? { opacity: 0.85 }
      : undefined;
}

function isActiveTask(m: MaintenanceItem) {
  return m.status !== "Completed" && !m.archived;
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
  const { width } = useWindowDimensions();
  const compactAdd = width < 420;
  const [filter, setFilter] = useState<MaintTab>("upcoming");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const pid = selectedProperty?.id ?? "";

  useEffect(() => {
    if (!tabParam) return;
    if (tabParam === "appliances" || tabParam === "repairs") {
      setFilter(tabParam);
    } else if (tabParam === "tasks" || tabParam === "upcoming") {
      setFilter("upcoming");
    } else if (tabParam === "overdue" || tabParam === "completed" || tabParam === "all") {
      setFilter(tabParam);
    }
  }, [tabParam]);

  const propMaintenance = useMemo(
    () => maintenanceItems.filter((m) => matchesPropertyId(m.propertyId, pid)),
    [maintenanceItems, pid]
  );
  const propRepairs = useMemo(
    () => repairs.filter((r) => matchesPropertyId(r.propertyId, pid)),
    [repairs, pid]
  );
  const propAppliances = useMemo(
    () => appliances.filter((a) => matchesPropertyId(a.propertyId, pid)),
    [appliances, pid]
  );

  const upcoming = propMaintenance.filter(
    (m) => isActiveTask(m) && (m.status === "Upcoming" || m.status === "Due Soon")
  );
  const overdue = propMaintenance.filter((m) => isActiveTask(m) && m.status === "Overdue");
  const completed = propMaintenance.filter((m) => m.status === "Completed" || m.archived);

  const counts: Record<MaintTab, number> = {
    upcoming: upcoming.length,
    overdue: overdue.length,
    completed: completed.length,
    appliances: propAppliances.length,
    repairs: propRepairs.length,
    all:
      propMaintenance.filter((m) => isActiveTask(m) || m.status === "Completed" || m.archived)
        .length +
      propAppliances.length +
      propRepairs.length,
  };

  function openTask(task: MaintenanceItem) {
    router.push(`/properties/${pid}?section=maintenance&tab=tasks&taskId=${task.id}`);
  }
  function openRepair(repair: Repair) {
    router.push(`/properties/${pid}?section=maintenance&tab=repairs&repairId=${repair.id}`);
  }
  function openAppliance(appliance: Appliance) {
    router.push(
      `/properties/${pid}?section=maintenance&tab=appliances&applianceId=${appliance.id}`
    );
  }
  function openAdd(kind: "maintenance" | "appliance" | "repair") {
    setAddMenuOpen(false);
    if (kind === "maintenance") {
      router.push(`/properties/${pid}?section=maintenance&tab=tasks&add=task`);
      return;
    }
    if (kind === "appliance") {
      router.push(`/properties/${pid}?section=maintenance&tab=appliances&add=appliance`);
      return;
    }
    router.push(`/properties/${pid}?section=maintenance&tab=repairs&add=repair`);
  }

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

  function renderTaskCard(item: MaintenanceItem) {
    return (
      <Pressable
        key={item.id}
        onPress={() => openTask(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open task ${item.title}`}
        style={({ pressed }) => webPointer(pressed)}
      >
        <Card style={{ marginBottom: 10 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.muted}>
                Due {formatDateForDisplay(item.nextDue) || "—"}
                {item.lastCompleted
                  ? ` · Completed ${formatDateForDisplay(item.lastCompleted) || item.lastCompleted}`
                  : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={statusBadge(item.status)}>{item.archived ? "Archived" : item.status}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </View>
          <Text style={{ color: colors.primary, fontWeight: "700", marginTop: 8, fontSize: 13 }}>
            View
          </Text>
        </Card>
      </Pressable>
    );
  }

  function renderEmpty(title: string, message: string, actionLabel: string, onAction: () => void) {
    return (
      <Card>
        <Text style={{ color: colors.textPrimary, fontWeight: "800", marginBottom: 6 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, marginBottom: 12 }}>{message}</Text>
        <Pressable style={styles.primaryButton} onPress={onAction}>
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      </Card>
    );
  }

  function renderBody() {
    if (filter === "upcoming") {
      if (upcoming.length === 0) {
        return renderEmpty(
          "No upcoming tasks",
          "Add your first maintenance task to stay ahead of home care.",
          "Add your first maintenance task",
          () => openAdd("maintenance")
        );
      }
      return upcoming.map(renderTaskCard);
    }
    if (filter === "overdue") {
      if (overdue.length === 0) {
        return renderEmpty(
          "No overdue tasks",
          "You're caught up. Add a task if something new needs attention.",
          "Add Task",
          () => openAdd("maintenance")
        );
      }
      return overdue.map(renderTaskCard);
    }
    if (filter === "completed") {
      if (completed.length === 0) {
        return (
          <Card>
            <Text style={{ color: colors.textPrimary, fontWeight: "800", marginBottom: 6 }}>
              No completed tasks
            </Text>
            <Text style={{ color: colors.textMuted }}>
              Completed tasks will appear here after you mark them complete.
            </Text>
          </Card>
        );
      }
      return completed.map(renderTaskCard);
    }
    if (filter === "appliances") {
      if (propAppliances.length === 0) {
        return renderEmpty(
          "No appliances",
          "Track HVAC, water heaters, and other equipment here.",
          "Add an appliance",
          () => openAdd("appliance")
        );
      }
      return propAppliances.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => openAppliance(a)}
          accessibilityRole="button"
          style={({ pressed }) => webPointer(pressed)}
        >
          <Card style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{a.name}</Text>
                <Text style={styles.muted}>
                  {[a.brand, a.model].filter(Boolean).join(" · ") || a.condition}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            <Text style={{ color: colors.primary, fontWeight: "700", marginTop: 8, fontSize: 13 }}>
              View
            </Text>
          </Card>
        </Pressable>
      ));
    }
    if (filter === "repairs") {
      if (propRepairs.length === 0) {
        return renderEmpty(
          "No repairs",
          "Keep a history of work done on this property.",
          "Log a repair",
          () => openAdd("repair")
        );
      }
      return propRepairs.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => openRepair(r)}
          accessibilityRole="button"
          style={({ pressed }) => webPointer(pressed)}
        >
          <Card style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                <Text style={styles.muted}>
                  {formatDateForDisplay(r.date) || r.date}
                  {r.cost ? ` · $${r.cost}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            <Text style={{ color: colors.primary, fontWeight: "700", marginTop: 8, fontSize: 13 }}>
              View
            </Text>
          </Card>
        </Pressable>
      ));
    }

    // all
    return (
      <View>
        <Text style={[styles.sectionHeader, { marginBottom: 8 }]}>Tasks</Text>
        {propMaintenance.filter((m) => isActiveTask(m) || m.status === "Completed" || m.archived)
          .length === 0
          ? renderEmpty(
              "No tasks yet",
              "Add your first maintenance task.",
              "Add Task",
              () => openAdd("maintenance")
            )
          : propMaintenance
              .filter((m) => isActiveTask(m) || m.status === "Completed" || m.archived)
              .map(renderTaskCard)}
        <Text style={[styles.sectionHeader, { marginTop: 16, marginBottom: 8 }]}>Appliances</Text>
        {propAppliances.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontStyle: "italic", marginBottom: 8 }}>
            No appliances yet.
          </Text>
        ) : (
          propAppliances.map((a) => (
            <Pressable key={a.id} onPress={() => openAppliance(a)} style={({ pressed }) => webPointer(pressed)}>
              <Card style={{ marginBottom: 10 }}>
                <Text style={styles.cardTitle}>{a.name}</Text>
                <Text style={styles.muted}>{a.condition}</Text>
              </Card>
            </Pressable>
          ))
        )}
        <Text style={[styles.sectionHeader, { marginTop: 16, marginBottom: 8 }]}>Repairs</Text>
        {propRepairs.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>No repairs yet.</Text>
        ) : (
          propRepairs.map((r) => (
            <Pressable key={r.id} onPress={() => openRepair(r)} style={({ pressed }) => webPointer(pressed)}>
              <Card style={{ marginBottom: 10 }}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                <Text style={styles.muted}>{formatDateForDisplay(r.date) || r.date}</Text>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    );
  }

  return (
    <Screen noPad tabScreen>
      <TabScreenHeader>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.tabHeaderTitle}>Maintenance</Text>
            <Text style={styles.tabHeaderSubtitle} numberOfLines={2}>
              {selectedProperty.address}
            </Text>
          </View>
          {compactAdd ? (
            <Pressable
              onPress={() => setAddMenuOpen(true)}
              style={[styles.primaryButton, { marginTop: 0, paddingVertical: 9, paddingHorizontal: 14 }]}
              accessibilityLabel="Add"
            >
              <Text style={styles.primaryButtonText}>+ Add</Text>
            </Pressable>
          ) : null}
        </View>
        {!compactAdd ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => openAdd("maintenance")}
              style={[styles.primaryButton, { marginTop: 0, paddingVertical: 8, paddingHorizontal: 12 }]}
            >
              <Text style={styles.primaryButtonText}>+ Add Task</Text>
            </Pressable>
            <Pressable
              onPress={() => openAdd("appliance")}
              style={[styles.secondaryButton, { marginTop: 0, paddingVertical: 8, paddingHorizontal: 12 }]}
            >
              <Text style={styles.secondaryButtonText}>+ Add Appliance</Text>
            </Pressable>
            <Pressable
              onPress={() => openAdd("repair")}
              style={[styles.secondaryButton, { marginTop: 0, paddingVertical: 8, paddingHorizontal: 12 }]}
            >
              <Text style={styles.secondaryButtonText}>+ Log Repair</Text>
            </Pressable>
          </View>
        ) : null}
      </TabScreenHeader>

      <ScrollView contentContainerStyle={tabScrollStyle}>
        {loadError ? <ErrorCard message={loadError} onRetry={refreshData} /> : null}
        <View style={{ height: 12 }} />

        <Pressable
          onPress={() => router.push("/settings/help")}
          style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
            How maintenance tasks work
          </Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {TABS.map((t) => {
            const selected = filter === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setFilter(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  selected && styles.chipActive,
                  { paddingHorizontal: 12 },
                  webPointer(),
                ]}
              >
                <Text style={selected ? styles.chipTextActive : styles.chipText}>
                  {t.label} ({counts[t.id]})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {renderBody()}
      </ScrollView>

      <Modal visible={addMenuOpen} transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setAddMenuOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bgCard,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              gap: 10,
            }}
          >
            <Text style={[styles.modalTitle, { marginBottom: 4 }]}>Add</Text>
            <Pressable style={styles.primaryButton} onPress={() => openAdd("maintenance")}>
              <Text style={styles.primaryButtonText}>Add Maintenance Task</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => openAdd("appliance")}>
              <Text style={styles.secondaryButtonText}>Add Appliance</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => openAdd("repair")}>
              <Text style={styles.secondaryButtonText}>Log Repair</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setAddMenuOpen(false)}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

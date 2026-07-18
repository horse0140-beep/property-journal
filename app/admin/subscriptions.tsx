import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { AdminField, AdminSelect } from "@/components/admin/AdminField";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { DatePickerField } from "@/components/DatePickerField";
import { colors, styles } from "@/constants/theme";
import {
  createSubscription,
  deleteSubscription,
  fetchSubscriptions,
  updateSubscription,
} from "@/services/subscriptionService";
import { fetchAdminUsers } from "@/services/adminService";
import type { AdminUser, BillingCycle, PlanKey, Subscription, SubscriptionStatus } from "@/types/admin";

const PLAN_OPTIONS: { label: string; value: PlanKey }[] = [
  { label: "Free", value: "free" },
  { label: "Premium", value: "premium" },
  { label: "Landlord", value: "landlord" },
  { label: "Realtor", value: "realtor" },
];

const STATUS_OPTIONS: { label: string; value: SubscriptionStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Trialing", value: "trialing" },
  { label: "Past Due", value: "past_due" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];

const CYCLE_OPTIONS: { label: string; value: BillingCycle }[] = [
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Trialing", value: "trialing" },
  { label: "Past Due", value: "past_due" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];

function statusVariant(status: SubscriptionStatus): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "active" || status === "trialing") return "success";
  if (status === "past_due") return "warning";
  if (status === "cancelled" || status === "expired") return "danger";
  return "muted";
}

function emptyForm(userId = "") {
  return {
    user_id: userId,
    plan_key: "premium" as PlanKey,
    status: "active" as SubscriptionStatus,
    billing_cycle: "monthly" as BillingCycle,
    amount: "",
    expires_at: "",
  };
}

export default function AdminSubscriptionsScreen() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const [subsData, usersData] = await Promise.all([fetchSubscriptions(), fetchAdminUsers()]);
      setSubs(subsData);
      setUsers(usersData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(users[0]?.id ?? ""));
    setModalOpen(true);
  }

  function openEdit(sub: Subscription) {
    setEditing(sub);
    setForm({
      user_id: sub.user_id,
      plan_key: sub.plan_key,
      status: sub.status,
      billing_cycle: sub.billing_cycle,
      amount: String(sub.amount),
      expires_at: sub.expires_at ? sub.expires_at.slice(0, 10) : "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.user_id) {
      Alert.alert("Validation", "Select a user.");
      return;
    }

    const payload = {
      user_id: form.user_id,
      plan_key: form.plan_key,
      status: form.status,
      billing_cycle: form.billing_cycle,
      amount: parseFloat(form.amount) || 0,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      cancelled_at: form.status === "cancelled" ? new Date().toISOString() : null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateSubscription(editing.id, payload);
      } else {
        await createSubscription(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save subscription");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(sub: Subscription) {
    Alert.alert("Delete Subscription", `Remove subscription for ${sub.user_email ?? sub.user_id}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSubscription(sub.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete subscription");
          }
        },
      },
    ]);
  }

  const q = search.toLowerCase().trim();
  const filtered = subs.filter((s) => {
    const matchesSearch =
      !q ||
      (s.user_email ?? "").toLowerCase().includes(q) ||
      (s.user_name ?? "").toLowerCase().includes(q) ||
      s.plan_key.includes(q) ||
      s.status.includes(q) ||
      s.billing_cycle.includes(q);
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = subs.filter((s) => s.status === "active" || s.status === "trialing").length;
  const userOptions = users.map((u) => ({ label: `${u.name} (${u.email})`, value: u.id }));

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader
          title="Subscription Management"
          subtitle={`${activeCount} active · ${subs.length} total`}
          rightAction={{ label: "+ Add", onPress: openCreate }}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <View style={{ position: "relative" }}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textMuted}
              style={{ position: "absolute", left: 14, top: 15, zIndex: 1 }}
            />
            <TextInput
              style={[styles.input, { paddingLeft: 42 }]}
              placeholder="Search user, plan, status…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FILTER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setStatusFilter(opt.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: statusFilter === opt.value ? colors.primary : colors.bgSection,
                  borderWidth: 1,
                  borderColor: statusFilter === opt.value ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: statusFilter === opt.value ? "#fff" : colors.textSecondary,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

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

            {filtered.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No subscriptions</Text>
                <Text style={styles.emptyStateText}>
                  {search || statusFilter !== "all"
                    ? "Try adjusting your filters."
                    : "Create a subscription to assign a paid plan."}
                </Text>
                {!search && statusFilter === "all" && (
                  <Pressable style={styles.primaryButton} onPress={openCreate}>
                    <Text style={styles.primaryButtonText}>Add Subscription</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              filtered.map((sub) => (
                <Card key={sub.id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{sub.user_name ?? "Unknown User"}</Text>
                      <Text style={styles.muted}>{sub.user_email}</Text>
                    </View>
                    <AdminBadge label={sub.status} variant={statusVariant(sub.status)} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <AdminBadge label={sub.plan_key} variant="primary" />
                    <AdminBadge label={sub.billing_cycle} variant="info" />
                    <AdminBadge label={`$${Number(sub.amount).toFixed(2)}`} variant="success" />
                  </View>
                  <Text style={[styles.muted, { marginTop: 8 }]}>
                    Started {new Date(sub.started_at).toLocaleDateString()}
                    {sub.expires_at ? ` · Expires ${new Date(sub.expires_at).toLocaleDateString()}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <Pressable onPress={() => openEdit(sub)} style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}>
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(sub)}
                      style={[styles.secondaryButton, { flex: 1, marginTop: 0, borderColor: colors.danger }]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        <AdminFormModal
          visible={modalOpen}
          title={editing ? "Edit Subscription" : "New Subscription"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saving={saving}
          saveLabel={editing ? "Update" : "Create"}
        >
          {userOptions.length > 0 ? (
            <AdminSelect
              label="User"
              value={form.user_id}
              options={userOptions}
              onChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
            />
          ) : (
            <AdminField
              label="User ID"
              value={form.user_id}
              onChangeText={(v) => setForm((f) => ({ ...f, user_id: v }))}
              autoCapitalize="none"
            />
          )}
          <AdminSelect
            label="Plan"
            value={form.plan_key}
            options={PLAN_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, plan_key: v as PlanKey }))}
          />
          <AdminSelect
            label="Status"
            value={form.status}
            options={STATUS_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, status: v as SubscriptionStatus }))}
          />
          <AdminSelect
            label="Billing Cycle"
            value={form.billing_cycle}
            options={CYCLE_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, billing_cycle: v as BillingCycle }))}
          />
          <AdminField
            label="Amount ($)"
            value={form.amount}
            onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
            keyboardType="decimal-pad"
            placeholder="4.99"
          />
          <DatePickerField
            label="Expires"
            value={form.expires_at}
            onChange={(iso) => setForm((f) => ({ ...f, expires_at: iso }))}
            optional
            placeholder="Select date"
          />
        </AdminFormModal>
      </Screen>
    </AdminGate>
  );
}

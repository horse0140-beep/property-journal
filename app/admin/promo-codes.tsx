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
import { AdminField, AdminSelect, AdminSwitch } from "@/components/admin/AdminField";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { DatePickerField } from "@/components/DatePickerField";
import { colors, styles } from "@/constants/theme";
import {
  createPromoCode,
  deletePromoCode,
  disablePromoCode,
  getPromoCodes,
  updatePromoCode,
} from "@/services/adminService";
import type { DiscountType, PlanKey, PromoCode } from "@/types/admin";

const DISCOUNT_OPTIONS: { label: string; value: DiscountType }[] = [
  { label: "Percent", value: "percent" },
  { label: "Fixed $", value: "fixed" },
  { label: "Free Trial", value: "free_trial" },
  { label: "Lifetime Access", value: "lifetime_access" },
  { label: "Owner Grant", value: "owner_grant" },
];

const SCOPE_OPTIONS: { label: string; value: PlanKey | "all" }[] = [
  { label: "All Plans", value: "all" },
  { label: "Free", value: "free" },
  { label: "Premium", value: "premium" },
  { label: "Landlord", value: "landlord" },
  { label: "Realtor", value: "realtor" },
];

function emptyForm() {
  return {
    code: "",
    description: "",
    discount_type: "percent" as DiscountType,
    discount_value: "",
    plan_scope: "all" as PlanKey | "all",
    max_uses: "",
    is_active: true,
    expires_at: "",
  };
}

function formatDiscount(promo: PromoCode) {
  if (promo.discount_type === "percent") return `${promo.discount_value}% off`;
  if (promo.discount_type === "fixed") return `$${promo.discount_value} off`;
  if (promo.discount_type === "free_trial") return `${promo.discount_value} day trial`;
  if (promo.discount_type === "lifetime_access") return `Lifetime ${promo.plan_scope} access`;
  if (promo.discount_type === "owner_grant") return "Owner access grant";
  return `${promo.discount_value}`;
}

export default function AdminPromoCodesScreen() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setPromos(await getPromoCodes());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load promo codes");
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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(promo: PromoCode) {
    setEditing(promo);
    setForm({
      code: promo.code,
      description: promo.description ?? "",
      discount_type: promo.discount_type,
      discount_value: String(promo.discount_value),
      plan_scope: promo.plan_scope,
      max_uses: promo.max_uses != null ? String(promo.max_uses) : "",
      is_active: promo.is_active,
      expires_at: promo.expires_at ? promo.expires_at.slice(0, 10) : "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.code.trim()) {
      Alert.alert("Validation", "Promo code is required.");
      return;
    }

    const payload = {
      code: form.code.trim(),
      description: form.description.trim() || undefined,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      plan_scope: form.plan_scope,
      max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      is_active: form.is_active,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updatePromoCode(editing.id, payload);
      } else {
        await createPromoCode(payload);
      }
      setModalOpen(false);
      await load();
      Alert.alert("Saved", "Promo code saved successfully.");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save promo code");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable(promo: PromoCode) {
    Alert.alert("Disable Promo", `Disable code "${promo.code}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disable",
        style: "destructive",
        onPress: async () => {
          setDisablingId(promo.id);
          try {
            await disablePromoCode(promo.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to disable promo");
          } finally {
            setDisablingId(null);
          }
        },
      },
    ]);
  }

  function confirmDelete(promo: PromoCode) {
    Alert.alert("Delete Promo", `Permanently remove code "${promo.code}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePromoCode(promo.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete promo");
          }
        },
      },
    ]);
  }

  const q = search.toLowerCase().trim();
  const filtered = promos.filter(
    (p) =>
      !q ||
      p.code.toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q) ||
      p.plan_scope.includes(q) ||
      p.discount_type.includes(q)
  );

  const activeCount = promos.filter((p) => p.is_active).length;
  const tableMissing =
    error.toLowerCase().includes("not found") || error.toLowerCase().includes("does not exist");

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader
          title="Promo Code Manager"
          subtitle={`${activeCount} active · ${promos.length} total`}
          rightAction={{ label: "+ Create", onPress: openCreate }}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ position: "relative" }}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textMuted}
              style={{ position: "absolute", left: 14, top: 15, zIndex: 1 }}
            />
            <TextInput
              style={[styles.input, { paddingLeft: 42 }]}
              placeholder="Search code, description, plan…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          >
            {error ? (
              <AdminErrorCard
                message={error}
                onRetry={load}
                title={tableMissing ? "Promo Codes Table Missing" : "Error Loading Promos"}
              />
            ) : null}

            {filtered.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <Ionicons name="ticket-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No promo codes</Text>
                <Text style={styles.emptyStateText}>
                  {search ? "Try a different search term." : "Create your first discount code."}
                </Text>
                {!search && (
                  <Pressable style={styles.primaryButton} onPress={openCreate}>
                    <Text style={styles.primaryButtonText}>Create Promo Code</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              filtered.map((promo) => (
                <Card key={promo.id}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { letterSpacing: 1 }]}>{promo.code}</Text>
                    <AdminBadge
                      label={promo.is_active ? "Active" : "Disabled"}
                      variant={promo.is_active ? "success" : "muted"}
                    />
                  </View>
                  <Text style={styles.muted}>{promo.description || "No description"}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <AdminBadge label={formatDiscount(promo)} variant="info" />
                    <AdminBadge label={`Applies: ${promo.plan_scope}`} variant="primary" />
                    <AdminBadge
                      label={`${promo.used_count}${promo.max_uses ? `/${promo.max_uses}` : ""} used`}
                      variant="muted"
                    />
                  </View>
                  {promo.expires_at && (
                    <Text style={[styles.muted, { marginTop: 8 }]}>
                      Expires {new Date(promo.expires_at).toLocaleDateString()}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <Pressable
                      onPress={() => openEdit(promo)}
                      style={[styles.secondaryButton, { flex: 1, minWidth: "30%", marginTop: 0 }]}
                    >
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    {promo.is_active && (
                      <Pressable
                        onPress={() => handleDisable(promo)}
                        disabled={disablingId === promo.id}
                        style={[
                          styles.secondaryButton,
                          { flex: 1, minWidth: "30%", marginTop: 0, borderColor: colors.warning },
                        ]}
                      >
                        <Text style={[styles.secondaryButtonText, { color: colors.warning }]}>
                          Disable
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => confirmDelete(promo)}
                      style={[
                        styles.secondaryButton,
                        { flex: 1, minWidth: "30%", marginTop: 0, borderColor: colors.danger },
                      ]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        <AdminFormModal
          visible={modalOpen}
          title={editing ? "Edit Promo Code" : "Create Promo Code"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saving={saving}
          saveLabel={editing ? "Update Code" : "Create Code"}
        >
          <AdminField
            label="Code"
            value={form.code}
            onChangeText={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
            autoCapitalize="characters"
            placeholder="SUMMER25"
          />
          <AdminField
            label="Description"
            value={form.description}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="Summer sale discount"
          />
          <AdminSelect
            label="Discount Type"
            value={form.discount_type}
            options={DISCOUNT_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, discount_type: v as DiscountType }))}
          />
          <AdminField
            label="Discount Amount"
            value={form.discount_value}
            onChangeText={(v) => setForm((f) => ({ ...f, discount_value: v }))}
            keyboardType="decimal-pad"
            placeholder="25"
          />
          <AdminSelect
            label="Applies To Plan"
            value={form.plan_scope}
            options={SCOPE_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, plan_scope: v as PlanKey | "all" }))}
          />
          <AdminField
            label="Usage Limit (blank = unlimited)"
            value={form.max_uses}
            onChangeText={(v) => setForm((f) => ({ ...f, max_uses: v }))}
            keyboardType="numeric"
          />
          <DatePickerField
            label="Expiration Date"
            value={form.expires_at}
            onChange={(iso) => setForm((f) => ({ ...f, expires_at: iso }))}
            optional
            placeholder="Select date"
          />
          <AdminSwitch
            label="Active"
            value={form.is_active}
            onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
          />
        </AdminFormModal>
      </Screen>
    </AdminGate>
  );
}

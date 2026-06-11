import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
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
import { colors, styles } from "@/constants/theme";
import {
  createPricingPlan,
  deletePricingPlan,
  fetchPricingPlans,
  updatePricingPlan,
} from "@/services/pricingService";
import type { PlanKey, PricingPlan } from "@/types/admin";

const PLAN_OPTIONS = [
  { label: "Free", value: "free" },
  { label: "Premium", value: "premium" },
  { label: "Landlord", value: "landlord" },
  { label: "Realtor", value: "realtor" },
];

function emptyForm() {
  return {
    plan_key: "premium" as PlanKey,
    name: "",
    monthly_price: "",
    yearly_price: "",
    description: "",
    features: "",
    is_active: true,
    sort_order: "0",
  };
}

export default function AdminPricingScreen() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingPlan | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setPlans(await fetchPricingPlans());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load pricing");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(plan: PricingPlan) {
    setEditing(plan);
    setForm({
      plan_key: plan.plan_key,
      name: plan.name,
      monthly_price: String(plan.monthly_price),
      yearly_price: String(plan.yearly_price),
      description: plan.description ?? "",
      features: (plan.features ?? []).join("\n"),
      is_active: plan.is_active,
      sort_order: String(plan.sort_order),
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Validation", "Plan name is required.");
      return;
    }

    const payload = {
      plan_key: form.plan_key,
      name: form.name.trim(),
      monthly_price: parseFloat(form.monthly_price) || 0,
      yearly_price: parseFloat(form.yearly_price) || 0,
      description: form.description.trim() || undefined,
      features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
      is_active: form.is_active,
      sort_order: parseInt(form.sort_order, 10) || 0,
    };

    setSaving(true);
    try {
      if (editing) {
        await updatePricingPlan(editing.id, payload);
      } else {
        await createPricingPlan(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(plan: PricingPlan) {
    Alert.alert("Delete Plan", `Remove "${plan.name}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePricingPlan(plan.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
          }
        },
      },
    ]);
  }

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader
          title="Pricing Plans"
          subtitle={`${plans.length} plans configured`}
          rightAction={{ label: "+ Add", onPress: openCreate }}
        />

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

            {plans.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <Ionicons name="pricetag-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No pricing plans</Text>
                <Text style={styles.emptyStateText}>Add your first subscription plan.</Text>
                <Pressable style={styles.primaryButton} onPress={openCreate}>
                  <Text style={styles.primaryButtonText}>Create Plan</Text>
                </Pressable>
              </View>
            ) : (
              plans.map((plan) => (
                <Card key={plan.id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{plan.name}</Text>
                      <AdminBadge label={plan.plan_key} variant="muted" />
                    </View>
                    <AdminBadge
                      label={plan.is_active ? "Active" : "Inactive"}
                      variant={plan.is_active ? "success" : "muted"}
                    />
                  </View>

                  {plan.description ? <Text style={[styles.muted, { marginTop: 8 }]}>{plan.description}</Text> : null}

                  <View style={{ flexDirection: "row", gap: 24, marginTop: 14 }}>
                    <View>
                      <Text style={styles.label}>Monthly</Text>
                      <Text style={styles.price}>${Number(plan.monthly_price).toFixed(2)}</Text>
                    </View>
                    <View>
                      <Text style={styles.label}>Yearly</Text>
                      <Text style={styles.price}>${Number(plan.yearly_price).toFixed(2)}</Text>
                    </View>
                  </View>

                  {(plan.features ?? []).length > 0 && (
                    <View style={{ marginTop: 12, gap: 4 }}>
                      {plan.features.map((f) => (
                        <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <Pressable onPress={() => openEdit(plan)} style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}>
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(plan)}
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
          title={editing ? "Edit Pricing Plan" : "New Pricing Plan"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saving={saving}
          saveLabel={editing ? "Update Plan" : "Create Plan"}
        >
          <AdminSelect
            label="Plan Key"
            value={form.plan_key}
            options={PLAN_OPTIONS}
            onChange={(v) => setForm((f) => ({ ...f, plan_key: v as PlanKey }))}
          />
          <AdminField label="Display Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Premium" />
          <AdminField label="Monthly Price ($)" value={form.monthly_price} onChangeText={(v) => setForm((f) => ({ ...f, monthly_price: v }))} keyboardType="decimal-pad" placeholder="4.99" />
          <AdminField label="Yearly Price ($)" value={form.yearly_price} onChangeText={(v) => setForm((f) => ({ ...f, yearly_price: v }))} keyboardType="decimal-pad" placeholder="39.99" />
          <AdminField label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline placeholder="Plan description for marketing" />
          <AdminField label="Features (one per line)" value={form.features} onChangeText={(v) => setForm((f) => ({ ...f, features: v }))} multiline placeholder="Unlimited properties" />
          <AdminField label="Sort Order" value={form.sort_order} onChangeText={(v) => setForm((f) => ({ ...f, sort_order: v }))} keyboardType="numeric" />
          <AdminSwitch label="Active" value={form.is_active} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        </AdminFormModal>
      </Screen>
    </AdminGate>
  );
}

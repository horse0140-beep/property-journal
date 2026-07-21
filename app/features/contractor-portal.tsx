import { useCallback, useState } from "react";
import {
  ScrollView, Text, View, Pressable, Alert, ActivityIndicator,
  RefreshControl, Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { PremiumGate } from "@/components/PremiumGate";
import { AdminFormModal } from "@/components/admin/AdminFormModal";
import { AdminField, AdminSelect, AdminSwitch } from "@/components/admin/AdminField";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useHomeWise } from "@/context/HomeWiseContext";
import {
  buildPortalUrl,
  createContractorAccess,
  deleteContractorAccess,
  fetchContractorAccess,
  updateContractorAccess,
} from "@/services/contractorPortalService";
import type { ContractorPortalAccess } from "@/types/premium";

const TRADES = [
  { label: "General", value: "General" },
  { label: "Plumbing", value: "Plumbing" },
  { label: "HVAC", value: "HVAC" },
  { label: "Electrical", value: "Electrical" },
  { label: "Roofing", value: "Roofing" },
  { label: "Landscaping", value: "Landscaping" },
];

const PERMISSION_OPTIONS = [
  { label: "Maintenance", value: "view_maintenance" },
  { label: "Repairs", value: "view_repairs" },
  { label: "Appliances", value: "view_appliances" },
  { label: "Documents", value: "view_documents" },
];

function emptyForm() {
  return {
    contractor_name: "",
    contractor_email: "",
    contractor_phone: "",
    trade: "General",
    permissions: ["view_maintenance", "view_repairs"] as string[],
    notes: "",
    is_active: true,
  };
}

export default function ContractorPortalScreen() {
  const { user } = useAuth();
  const { selectedProperty } = useHomeWise();
  const [accessList, setAccessList] = useState<ContractorPortalAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContractorPortalAccess | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setAccessList(await fetchContractorAccess(user.id));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function openCreate() {
    if (!selectedProperty) {
      Alert.alert("No Property", "Select a property first.");
      return;
    }
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(entry: ContractorPortalAccess) {
    setEditing(entry);
    setForm({
      contractor_name: entry.contractor_name,
      contractor_email: entry.contractor_email,
      contractor_phone: entry.contractor_phone ?? "",
      trade: entry.trade,
      permissions: entry.permissions,
      notes: entry.notes ?? "",
      is_active: entry.is_active,
    });
    setModalOpen(true);
  }

  function togglePermission(perm: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  }

  async function handleSave() {
    if (!user?.id || !selectedProperty) return;
    if (!form.contractor_name.trim() || !form.contractor_email.trim()) {
      Alert.alert("Validation", "Contractor name and email are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        property_id: editing?.property_id ?? selectedProperty.id,
        property_label: editing?.property_label ?? selectedProperty.address,
        contractor_name: form.contractor_name.trim(),
        contractor_email: form.contractor_email.trim().toLowerCase(),
        contractor_phone: form.contractor_phone.trim() || undefined,
        trade: form.trade,
        permissions: form.permissions,
        notes: form.notes.trim() || undefined,
        is_active: form.is_active,
      };

      if (editing) {
        await updateContractorAccess(editing.id, payload);
      } else {
        await createContractorAccess(user.id, payload);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function inviteContractor(entry: ContractorPortalAccess) {
    const url = buildPortalUrl(entry.access_code);
    await Share.share({
      message: `You've been invited to the Property Journal Contractor Portal for ${entry.property_label}.\n\nPortal: ${url}\nAccess Code: ${entry.access_code}\n\nYou can view assigned maintenance and repair schedules.`,
      title: "Property Journal Contractor Portal Invite",
    });
  }

  function confirmDelete(entry: ContractorPortalAccess) {
    Alert.alert("Revoke Access", `Remove portal access for ${entry.contractor_name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          await deleteContractorAccess(entry.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen noPad>
      <PremiumGate
        feature="contractor_portal"
        featureName="Contractor Portal"
        description="Give trusted contractors secure access to maintenance schedules and repair history for your properties."
      >
        <AdminHeader
          title="Contractor Portal"
          subtitle="Manage contractor access"
          backTo="/features"
          rightAction={{ label: "+ Invite", onPress: openCreate }}
        />

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          >
            {accessList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="hammer-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No contractors invited</Text>
                <Text style={styles.emptyStateText}>
                  Invite contractors to view maintenance tasks, repair history, and property details for the jobs you assign them.
                </Text>
                <Pressable style={styles.primaryButton} onPress={openCreate}>
                  <Text style={styles.primaryButtonText}>Invite Contractor</Text>
                </Pressable>
              </View>
            ) : (
              accessList.map((entry) => (
                <Card key={entry.id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{entry.contractor_name}</Text>
                      <Text style={styles.muted}>{entry.contractor_email}</Text>
                    </View>
                    <AdminBadge label={entry.trade} variant="primary" />
                  </View>
                  <Text style={[styles.muted, { marginTop: 6 }]}>{entry.property_label}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "800", marginTop: 8 }}>
                    Code: {entry.access_code}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {entry.permissions.map((p) => (
                      <AdminBadge key={p} label={p.replace("view_", "")} variant="info" />
                    ))}
                    <AdminBadge label={entry.is_active ? "Active" : "Inactive"} variant={entry.is_active ? "success" : "muted"} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <Pressable onPress={() => inviteContractor(entry)} style={[styles.primaryButton, { flex: 1, marginTop: 0, paddingVertical: 12 }]}>
                      <Text style={styles.primaryButtonText}>Send Invite</Text>
                    </Pressable>
                    <Pressable onPress={() => openEdit(entry)} style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}>
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(entry)} style={[styles.secondaryButton, { marginTop: 0, borderColor: colors.danger }]}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        <AdminFormModal visible={modalOpen} title={editing ? "Edit Contractor" : "Invite Contractor"} onClose={() => setModalOpen(false)} onSave={handleSave} saving={saving}>
          <AdminField label="Contractor Name" value={form.contractor_name} onChangeText={(v) => setForm((f) => ({ ...f, contractor_name: v }))} placeholder="Mike's Plumbing" />
          <AdminField label="Email" value={form.contractor_email} onChangeText={(v) => setForm((f) => ({ ...f, contractor_email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="mike@plumbing.com" />
          <AdminField label="Phone" value={form.contractor_phone} onChangeText={(v) => setForm((f) => ({ ...f, contractor_phone: v }))} keyboardType="numeric" placeholder="555-555-5555" />
          <AdminSelect label="Trade" value={form.trade} options={TRADES} onChange={(v) => setForm((f) => ({ ...f, trade: v }))} />
          <Text style={styles.label}>Permissions</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {PERMISSION_OPTIONS.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => togglePermission(p.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: form.permissions.includes(p.value) ? colors.primary : colors.bgSection,
                  borderWidth: 1,
                  borderColor: form.permissions.includes(p.value) ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: form.permissions.includes(p.value) ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <AdminField label="Notes" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline placeholder="Gate code, parking instructions..." />
          <AdminSwitch label="Active" value={form.is_active} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        </AdminFormModal>
      </PremiumGate>
    </Screen>
  );
}

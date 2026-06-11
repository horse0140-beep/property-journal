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
import { AdminSelect } from "@/components/admin/AdminField";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  deleteUser,
  fetchAdminUsers,
  setUserRole,
  updateUserPlan,
} from "@/services/adminService";
import type { AdminUser, PlanKey, UserRole } from "@/types/admin";

const PLAN_OPTIONS = [
  { label: "Free", value: "free" },
  { label: "Premium", value: "premium" },
  { label: "Landlord", value: "landlord" },
  { label: "Realtor", value: "realtor" },
];

const ROLE_OPTIONS = [
  { label: "User", value: "user" },
  { label: "Super Admin", value: "super_admin" },
  { label: "Support", value: "support" },
  { label: "Moderator", value: "moderator" },
];

export default function AdminUsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editPlan, setEditPlan] = useState<PlanKey>("free");
  const [editRole, setEditRole] = useState<UserRole>("user");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setUsers(await fetchAdminUsers());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
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

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEditPlan(u.plan);
    setEditRole(u.role ?? "user");
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateUserPlan(editing.id, editPlan);
      await setUserRole(editing.id, editRole);
      setEditing(null);
      await load();
      Alert.alert("Saved", `${editing.email} updated successfully.`);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(u: AdminUser) {
    if (u.id === currentUser?.id) {
      Alert.alert("Cannot Delete", "You cannot delete your own account from admin.");
      return;
    }
    Alert.alert("Delete User", `Permanently remove ${u.email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteUser(u.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
          }
        },
      },
    ]);
  }

  const q = search.toLowerCase().trim();
  const filtered = users.filter(
    (u) =>
      !q ||
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.phone ?? "").includes(q) ||
      (u.role ?? "").includes(q) ||
      u.plan.includes(q)
  );

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader title="Users" subtitle={`${users.length} registered accounts`} />

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
              placeholder="Search name, email, phone, plan, role…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={[styles.muted, { marginTop: 6, marginBottom: 4 }]}>
            Showing {filtered.length} of {users.length}
          </Text>
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
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No users found</Text>
                <Text style={styles.emptyStateText}>
                  {search ? "Try a different search term." : "Users will appear after sign-up."}
                </Text>
              </View>
            ) : (
              filtered.map((u) => (
                <Card key={u.id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: colors.bgSection,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 16 }}>
                          {u.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{u.name}</Text>
                        <Text style={styles.muted}>{u.email}</Text>
                        <Text style={styles.muted}>Phone: {u.phone || "Not added"}</Text>
                        <Text style={[styles.muted, { fontSize: 11 }]}>
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <AdminBadge label={u.plan} variant="primary" />
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <AdminBadge
                      label={u.role ?? "user"}
                      variant={u.role === "super_admin" ? "warning" : "muted"}
                    />
                    {u.id === currentUser?.id && <AdminBadge label="You" variant="info" />}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <Pressable
                      onPress={() => openEdit(u)}
                      style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}
                    >
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    {u.id !== currentUser?.id && (
                      <Pressable
                        onPress={() => confirmDelete(u)}
                        style={[styles.secondaryButton, { flex: 1, marginTop: 0, borderColor: colors.danger }]}
                      >
                        <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        <AdminFormModal
          visible={!!editing}
          title="Edit User"
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
          saveLabel="Save Changes"
        >
          {editing && (
            <>
              <Text style={styles.cardTitle}>{editing.name}</Text>
              <Text style={[styles.muted, { marginBottom: 12 }]}>{editing.email}</Text>
              <AdminSelect
                label="Subscription Plan"
                value={editPlan}
                options={PLAN_OPTIONS}
                onChange={(v) => setEditPlan(v as PlanKey)}
              />
              <AdminSelect
                label="User Role"
                value={editRole}
                options={ROLE_OPTIONS}
                onChange={(v) => setEditRole(v as UserRole)}
              />
            </>
          )}
        </AdminFormModal>
      </Screen>
    </AdminGate>
  );
}

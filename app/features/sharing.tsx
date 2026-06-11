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
import { AdminField, AdminSwitch } from "@/components/admin/AdminField";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useHomeWise } from "@/context/HomeWiseContext";
import {
  buildShareUrl,
  createPropertyShare,
  deletePropertyShare,
  fetchPropertyShares,
  updatePropertyShare,
} from "@/services/sharingService";
import type { PropertyShare } from "@/types/premium";

export default function PropertySharingScreen() {
  const { user } = useAuth();
  const { selectedProperty, maintenanceItems, repairs, appliances, getPropertyScore } = useHomeWise();
  const [shares, setShares] = useState<PropertyShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyShare | null>(null);
  const [label, setLabel] = useState("");
  const [includePersonal, setIncludePersonal] = useState(false);
  const [expiresDays, setExpiresDays] = useState("30");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setShares(await fetchPropertyShares(user.id));
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
    setLabel(`${selectedProperty.address} Share`);
    setIncludePersonal(false);
    setExpiresDays("30");
    setModalOpen(true);
  }

  function openEdit(share: PropertyShare) {
    setEditing(share);
    setLabel(share.label);
    setIncludePersonal(share.include_personal_info);
    setExpiresDays("30");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!user?.id || !selectedProperty) return;
    setSaving(true);
    try {
      const expires_at = expiresDays
        ? new Date(Date.now() + parseInt(expiresDays, 10) * 86400000).toISOString()
        : null;

      const pid = selectedProperty.id;
      const snapshot = {
        address: selectedProperty.address,
        city: selectedProperty.city,
        state: selectedProperty.state,
        score: getPropertyScore(pid),
        maintenanceCount: maintenanceItems.filter((m) => m.propertyId === pid).length,
        repairCount: repairs.filter((r) => r.propertyId === pid).length,
        applianceCount: appliances.filter((a) => a.propertyId === pid).length,
      };

      if (editing) {
        await updatePropertyShare(editing.id, {
          label: label.trim(),
          include_personal_info: includePersonal,
          expires_at,
        });
      } else {
        await createPropertyShare(user.id, {
          property_id: pid,
          property_label: selectedProperty.address,
          label: label.trim(),
          include_personal_info: includePersonal,
          expires_at,
          snapshot_json: snapshot,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function shareLink(share: PropertyShare) {
    const url = buildShareUrl(share.share_token);
    await Share.share({
      message: `View my HomeWise property history: ${url}\n\nToken: ${share.share_token}`,
      title: share.label,
    });
  }

  function confirmDelete(share: PropertyShare) {
    Alert.alert("Revoke Share", `Remove "${share.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          await deletePropertyShare(share.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen noPad>
      <PremiumGate
        feature="property_sharing"
        featureName="Property Sharing"
        description="Create secure share links so family, insurers, or partners can view your property history without full account access."
      >
        <AdminHeader
          title="Property Sharing"
          subtitle="Secure read-only links"
          backTo="/features"
          rightAction={{ label: "+ New", onPress: openCreate }}
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
            {shares.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="share-social-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No shares yet</Text>
                <Text style={styles.emptyStateText}>
                  Create a link to share your property's maintenance history, health score, and repair records.
                </Text>
                <Pressable style={[styles.primaryButton, { alignSelf: "stretch" }]} onPress={openCreate}>
                  <Text style={styles.primaryButtonText}>Create Share Link</Text>
                </Pressable>
              </View>
            ) : (
              shares.map((share) => (
                <Card key={share.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{share.label}</Text>
                    <AdminBadge label={share.is_active ? "Active" : "Inactive"} variant={share.is_active ? "success" : "muted"} />
                  </View>
                  <Text style={styles.muted}>{share.property_label}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "800", marginTop: 8, letterSpacing: 1 }}>
                    {share.share_token}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <AdminBadge label={`${share.views_count} views`} variant="muted" />
                    {share.expires_at && (
                      <AdminBadge label={`Expires ${new Date(share.expires_at).toLocaleDateString()}`} variant="info" />
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <Pressable onPress={() => shareLink(share)} style={[styles.primaryButton, { flex: 1, marginTop: 0, paddingVertical: 12 }]}>
                      <Ionicons name="share-outline" size={16} color="#fff" />
                      <Text style={styles.primaryButtonText}>Share</Text>
                    </Pressable>
                    <Pressable onPress={() => openEdit(share)} style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}>
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(share)} style={[styles.secondaryButton, { marginTop: 0, borderColor: colors.danger }]}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        <AdminFormModal visible={modalOpen} title={editing ? "Edit Share" : "New Share Link"} onClose={() => setModalOpen(false)} onSave={handleSave} saving={saving}>
          <AdminField label="Link Label" value={label} onChangeText={setLabel} placeholder="Buyer Preview Link" />
          <AdminField label="Expires In (days)" value={expiresDays} onChangeText={setExpiresDays} keyboardType="numeric" placeholder="30" />
          <AdminSwitch label="Include owner contact info" value={includePersonal} onValueChange={setIncludePersonal} />
        </AdminFormModal>
      </PremiumGate>
    </Screen>
  );
}

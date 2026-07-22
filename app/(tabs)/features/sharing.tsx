import { useCallback, useState } from "react";
import {
  ScrollView, Text, View, Pressable, Alert, ActivityIndicator,
  RefreshControl, Platform,
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
  createPropertyShare,
  fetchPropertyShares,
  isShareConfigured,
  revokePropertyShare,
  SHARE_NOT_CONFIGURED_MESSAGE,
  updatePropertyShare,
} from "@/services/sharingService";
import { buildShareUrl, logShareUrlConfig } from "@/lib/shareUrl";
import { notifyUser, openShareLink, sharePropertyLink } from "@/lib/webShare";
import { UserFacingError, friendlyMessage, logTechnicalError } from "@/lib/userErrors";
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
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  /** Tracks in-flight Share / Open Link so the spinner always clears in finally. */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setShares(await fetchPropertyShares(user.id));
    } catch (e: unknown) {
      logTechnicalError("loadPropertyShares", e);
      notifyUser("Error", e instanceof UserFacingError ? e.userMessage : friendlyMessage("sharing"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    logShareUrlConfig();
    setLoading(true);
    load();
  }, [load]));

  const shareConfigured = isShareConfigured();

  function openCreate() {
    if (!selectedProperty) {
      notifyUser("No Property", "Select a property first.");
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
    } catch (e: unknown) {
      logTechnicalError("savePropertyShare", e);
      notifyUser("Error", e instanceof UserFacingError ? e.userMessage : friendlyMessage("sharing_create"));
    } finally {
      setSaving(false);
    }
  }

  async function shareLink(share: PropertyShare) {
    if (busyKey) return;
    const key = `share:${share.share_token}`;
    setBusyKey(key);
    setShareFeedback(null);
    let result: Awaited<ReturnType<typeof sharePropertyLink>> | null = null;
    try {
      result = await sharePropertyLink({
        token: share.share_token,
        label: share.label,
        propertyLabel: share.property_label,
      });
    } finally {
      setBusyKey(null);
    }

    if (!result) return;
    if (result.ok) {
      setShareFeedback(`Share link copied\n${result.url}`);
      notifyUser("Share link copied", result.url);
    } else {
      setShareFeedback(result.error);
      notifyUser("Share failed", result.error);
    }
  }

  async function openLink(share: PropertyShare) {
    if (busyKey) return;
    const key = `open:${share.share_token}`;
    setBusyKey(key);
    setShareFeedback(null);
    let result: Awaited<ReturnType<typeof openShareLink>> | null = null;
    try {
      result = await openShareLink(share.share_token);
    } finally {
      setBusyKey(null);
    }

    if (!result) return;
    if (result.ok) {
      setShareFeedback(`Opened\n${result.url}`);
    } else {
      setShareFeedback(result.error);
      notifyUser("Open failed", result.error);
    }
  }

  function confirmDelete(share: PropertyShare) {
    const runRevoke = async () => {
      try {
        await revokePropertyShare(share.id);
        await load();
      } catch (e: unknown) {
        logTechnicalError("revokePropertyShare", e);
        notifyUser("Error", e instanceof UserFacingError ? e.userMessage : friendlyMessage("sharing_revoke"));
      }
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Remove "${share.label}"?`)) {
        void runRevoke();
      }
      return;
    }

    Alert.alert("Revoke Share", `Remove "${share.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () => {
          void runRevoke();
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

        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600" }}>
            Anyone with an active link can view the read-only report.
          </Text>
        </View>

        {!shareConfigured ? (
          <View style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#F59E0B" }}>
            <Text style={{ color: "#92400E", fontWeight: "700" }}>{SHARE_NOT_CONFIGURED_MESSAGE}</Text>
            <Text style={{ color: "#92400E", marginTop: 4, fontSize: 12 }}>
              Set EXPO_PUBLIC_SHARE_BASE_URL to your deployed web app origin
              (e.g. https://property-journal.vercel.app). Links become {"/share/<token>"}.
            </Text>
          </View>
        ) : null}

        {shareFeedback ? (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              padding: 12,
              borderRadius: 10,
              backgroundColor: colors.successBg ?? "#ECFDF5",
              borderWidth: 1,
              borderColor: colors.success,
            }}
          >
            <Text style={{ color: colors.success, fontWeight: "700" }}>{shareFeedback}</Text>
            <Pressable onPress={() => setShareFeedback(null)} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

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
                  Create a link to share your property&apos;s maintenance history, health score, and repair records.
                </Text>
                <Pressable style={[styles.primaryButton, { alignSelf: "stretch" }]} onPress={openCreate}>
                  <Text style={styles.primaryButtonText}>Create Share Link</Text>
                </Pressable>
              </View>
            ) : (
              shares.map((share) => {
                const publicUrl = buildShareUrl(share.share_token);
                const shareBusy = busyKey === `share:${share.share_token}`;
                const openBusy = busyKey === `open:${share.share_token}`;
                const rowBusy = shareBusy || openBusy || Boolean(busyKey);
                return (
                  <Card key={share.id}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>{share.label}</Text>
                      <AdminBadge label={share.is_active ? "Active" : "Inactive"} variant={share.is_active ? "success" : "muted"} />
                    </View>
                    <Text style={styles.muted}>{share.property_label}</Text>
                    {publicUrl ? (
                      <Text
                        style={{ color: colors.primary, fontWeight: "600", marginTop: 8, fontSize: 12 }}
                        numberOfLines={2}
                        selectable
                      >
                        {publicUrl}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.primary, fontWeight: "800", marginTop: 8, letterSpacing: 1 }}>
                        {share.share_token}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <AdminBadge label={`${share.views_count} views`} variant="muted" />
                      {share.expires_at && (
                        <AdminBadge label={`Expires ${new Date(share.expires_at).toLocaleDateString()}`} variant="info" />
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      <Pressable
                        onPress={() => void shareLink(share)}
                        disabled={rowBusy || !shareConfigured}
                        style={[styles.primaryButton, { flex: 1, minWidth: 100, marginTop: 0, paddingVertical: 12, opacity: rowBusy || !shareConfigured ? 0.6 : 1 }]}
                      >
                        {shareBusy ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="share-outline" size={16} color="#fff" />
                            <Text style={styles.primaryButtonText}>Share</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => void openLink(share)}
                        disabled={rowBusy || !shareConfigured}
                        style={[styles.secondaryButton, { flex: 1, minWidth: 100, marginTop: 0, opacity: rowBusy || !shareConfigured ? 0.6 : 1 }]}
                      >
                        {openBusy ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : (
                          <Text style={styles.secondaryButtonText}>Open Link</Text>
                        )}
                      </Pressable>
                      <Pressable onPress={() => openEdit(share)} style={[styles.secondaryButton, { flex: 1, minWidth: 80, marginTop: 0 }]}>
                        <Text style={styles.secondaryButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => confirmDelete(share)} style={[styles.secondaryButton, { marginTop: 0, borderColor: colors.danger }]}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })
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

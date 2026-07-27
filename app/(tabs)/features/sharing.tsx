import { useCallback, useMemo, useState } from "react";
import {
  ScrollView, Text, View, Pressable, Alert, ActivityIndicator,
  RefreshControl, Platform, Modal,
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
import { ShareReportView } from "@/components/ShareReportView";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useHomeWise } from "@/context/HomeWiseContext";
import {
  createPropertyShare,
  fetchPropertyShares,
  isShareConfigured,
  regeneratePropertyShareToken,
  revokePropertyShare,
  SHARE_NOT_CONFIGURED_MESSAGE,
  updatePropertyShare,
} from "@/services/sharingService";
import { buildShareUrl, logShareUrlConfig } from "@/lib/shareUrl";
import { buildPropertyShareSnapshot } from "@/lib/shareSnapshot";
import {
  SHARE_PRESETS,
  SHARE_SECTION_LABELS,
  SENSITIVE_SECTION_KEYS,
  applySharePreset,
  defaultSharePermissions,
  hasAnyShareSelection,
  parseSharePermissions,
  inferPermissionsFromSnapshot,
  toggleItemId,
  type SharePermissions,
  type SharePresetId,
  type ShareSectionKey,
} from "@/lib/sharePermissions";
import { shareAudit } from "@/lib/shareAudit";
import { notifyUser, openShareLink, sharePropertyLink } from "@/lib/webShare";
import { UserFacingError, friendlyMessage, logTechnicalError } from "@/lib/userErrors";
import type { PropertyShare } from "@/types/premium";

const SECTION_ORDER: ShareSectionKey[] = [
  "basicPropertyInfo",
  "propertyAddress",
  "propertyPhotos",
  "maintenanceHistory",
  "upcomingMaintenance",
  "completedRepairs",
  "repairCosts",
  "contractorContact",
  "appliances",
  "appliancePhotos",
  "applianceModelSerial",
  "documents",
  "warranties",
  "receipts",
  "inspectionReports",
  "permits",
  "ownerMessage",
  "ownerContact",
];

type ItemRow = {
  id: string;
  title: string;
  category: string;
  date: string;
};

export default function PropertySharingScreen() {
  const { user } = useAuth();
  const {
    selectedProperty,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
  } = useHomeWise();
  const [shares, setShares] = useState<PropertyShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyShare | null>(null);
  const [label, setLabel] = useState("");
  const [ownerMessage, setOwnerMessage] = useState("");
  const [expiresDays, setExpiresDays] = useState("30");
  const [permissions, setPermissions] = useState<SharePermissions>(() => defaultSharePermissions());
  const [saving, setSaving] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const propertyId = selectedProperty?.id;

  const catalog = useMemo(() => {
    if (!propertyId) {
      return {
        maintenance: [] as ItemRow[],
        repairs: [] as ItemRow[],
        appliances: [] as ItemRow[],
        documents: [] as ItemRow[],
        photos: [] as ItemRow[],
        ids: {
          maintenance: [] as string[],
          repairs: [] as string[],
          appliances: [] as string[],
          documents: [] as string[],
          photos: [] as string[],
        },
      };
    }
    const maint = maintenanceItems
      .filter((m) => m.propertyId === propertyId)
      .map((m) => ({
        id: m.id,
        title: m.title,
        category: m.category || "Maintenance",
        date: m.lastCompleted || m.nextDue || "",
      }));
    const rep = repairs
      .filter((r) => r.propertyId === propertyId)
      .map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category || "Repair",
        date: r.date || "",
      }));
    const apps = appliances
      .filter((a) => a.propertyId === propertyId)
      .map((a) => ({
        id: a.id,
        title: a.name,
        category: a.category || "Appliance",
        date: a.installDate || a.warrantyExpires || "",
      }));
    const docs = documents
      .filter((d) => d.propertyId === propertyId)
      .map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category || "Document",
        date: d.uploadDate || d.expiresDate || "",
      }));
    const ph = photos
      .filter((p) => p.propertyId === propertyId && Boolean(p.uri?.trim()))
      .map((p) => ({
        id: p.id,
        title: p.caption || p.category || "Photo",
        category: p.category || "Photo",
        date: p.date || "",
      }));
    return {
      maintenance: maint,
      repairs: rep,
      appliances: apps,
      documents: docs,
      photos: ph,
      ids: {
        maintenance: maint.map((x) => x.id),
        repairs: rep.map((x) => x.id),
        appliances: apps.map((x) => x.id),
        documents: docs.map((x) => x.id),
        photos: ph.map((x) => x.id),
      },
    };
  }, [propertyId, maintenanceItems, repairs, appliances, documents, photos]);

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
    setOwnerMessage("");
    setExpiresDays("30");
    setPermissions(defaultSharePermissions());
    setModalOpen(true);
  }

  function openEdit(share: PropertyShare) {
    setEditing(share);
    setLabel(share.label);
    const snap =
      typeof share.snapshot_json === "object" && share.snapshot_json && !Array.isArray(share.snapshot_json)
        ? (share.snapshot_json as Record<string, unknown>)
        : null;
    setOwnerMessage(String(snap?.ownerMessage ?? ""));
    const inferred = inferPermissionsFromSnapshot(snap);
    const hasIds =
      inferred.itemIds.maintenance.length ||
      inferred.itemIds.repairs.length ||
      inferred.itemIds.appliances.length ||
      inferred.itemIds.documents.length ||
      inferred.itemIds.photos.length;
    setPermissions(
      hasIds
        ? inferred
        : {
            ...inferred,
            itemIds: {
              maintenance:
                inferred.sections.maintenanceHistory || inferred.sections.upcomingMaintenance
                  ? [...catalog.ids.maintenance]
                  : [],
              repairs: inferred.sections.completedRepairs ? [...catalog.ids.repairs] : [],
              appliances: inferred.sections.appliances ? [...catalog.ids.appliances] : [],
              documents:
                inferred.sections.documents ||
                inferred.sections.warranties ||
                inferred.sections.receipts ||
                inferred.sections.inspectionReports ||
                inferred.sections.permits
                  ? [...catalog.ids.documents]
                  : [],
              photos: inferred.sections.propertyPhotos ? [...catalog.ids.photos] : [],
            },
          }
    );
    if (share.expires_at) {
      const days = Math.max(
        1,
        Math.ceil((new Date(share.expires_at).getTime() - Date.now()) / 86400000)
      );
      setExpiresDays(String(days));
    } else {
      setExpiresDays("30");
    }
    setModalOpen(true);
  }

  function applyPreset(preset: SharePresetId) {
    setPermissions(applySharePreset(preset, catalog.ids));
  }

  function setSection(key: ShareSectionKey, value: boolean) {
    setPermissions((prev) => {
      const next: SharePermissions = {
        ...prev,
        preset: "custom",
        sections: { ...prev.sections, [key]: value },
      };
      // Turning on a list section with no items selected → select all for convenience
      if (value) {
        if (
          (key === "maintenanceHistory" || key === "upcomingMaintenance") &&
          next.itemIds.maintenance.length === 0
        ) {
          next.itemIds = { ...next.itemIds, maintenance: [...catalog.ids.maintenance] };
        }
        if (key === "completedRepairs" && next.itemIds.repairs.length === 0) {
          next.itemIds = { ...next.itemIds, repairs: [...catalog.ids.repairs] };
        }
        if (key === "appliances" && next.itemIds.appliances.length === 0) {
          next.itemIds = { ...next.itemIds, appliances: [...catalog.ids.appliances] };
        }
        if (key === "propertyPhotos" && next.itemIds.photos.length === 0) {
          next.itemIds = { ...next.itemIds, photos: [...catalog.ids.photos] };
        }
        if (
          (key === "documents" ||
            key === "warranties" ||
            key === "receipts" ||
            key === "inspectionReports" ||
            key === "permits") &&
          next.itemIds.documents.length === 0
        ) {
          next.itemIds = { ...next.itemIds, documents: [...catalog.ids.documents] };
        }
      }
      return next;
    });
  }

  function buildSnapshotFromForm() {
    if (!selectedProperty) return null;
    return buildPropertyShareSnapshot({
      property: selectedProperty,
      maintenanceItems,
      repairs,
      appliances,
      documents,
      photos,
      permissions: {
        ...permissions,
        sections: {
          ...permissions.sections,
          ownerMessage: permissions.sections.ownerMessage && Boolean(ownerMessage.trim()),
          ownerContact: permissions.sections.ownerContact,
        },
      },
      ownerMessage,
      ownerEmail: user?.email ?? undefined,
      ownerPhone: user?.phone ?? undefined,
    });
  }

  async function handleSave() {
    if (!user?.id || !selectedProperty) return;
    if (!hasAnyShareSelection(permissions, ownerMessage)) {
      notifyUser("Choose content", "Choose at least one item to share.");
      return;
    }
    setSaving(true);
    try {
      const expires_at = expiresDays
        ? new Date(Date.now() + parseInt(expiresDays, 10) * 86400000).toISOString()
        : null;

      const snapshot = buildSnapshotFromForm();
      if (!snapshot) return;

      if (editing) {
        await updatePropertyShare(editing.id, {
          label: label.trim(),
          include_personal_info: permissions.sections.ownerContact,
          expires_at,
          snapshot_json: snapshot as unknown as Record<string, unknown>,
        });
      } else {
        await createPropertyShare(user.id, {
          property_id: selectedProperty.id,
          property_label: selectedProperty.nickname || selectedProperty.address,
          label: label.trim(),
          include_personal_info: permissions.sections.ownerContact,
          expires_at,
          snapshot_json: snapshot as unknown as Record<string, unknown>,
        });
      }
      setModalOpen(false);
      setPreviewOpen(false);
      await load();
    } catch (e: unknown) {
      logTechnicalError("savePropertyShare", e);
      notifyUser("Error", e instanceof UserFacingError ? e.userMessage : friendlyMessage("sharing_create"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!editing) return;
    const run = async () => {
      try {
        await regeneratePropertyShareToken(editing.id);
        notifyUser("Link regenerated", "The old link no longer works. Share the new URL.");
        setModalOpen(false);
        await load();
      } catch (e: unknown) {
        logTechnicalError("regeneratePropertyShareToken", e);
        notifyUser("Error", e instanceof UserFacingError ? e.userMessage : friendlyMessage("sharing"));
      }
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Generate a new token? The current link will stop working.")) {
        void run();
      }
      return;
    }
    Alert.alert("Regenerate link", "Generate a new token? The current link will stop working.", [
      { text: "Cancel", style: "cancel" },
      { text: "Regenerate", style: "destructive", onPress: () => void run() },
    ]);
  }

  async function shareLink(share: PropertyShare) {
    if (busyKey) return;
    const key = `share:${share.share_token}`;
    shareAudit("01", { action: "Share button pressed" });
    shareAudit("02", { shareRecordId: share.id });
    shareAudit("03", { token: share.share_token });
    shareAudit("04", { tokenLength: share.share_token?.trim().length ?? 0 });
    shareAudit("05", { activeStatus: share.is_active });
    shareAudit("06", { expirationValue: share.expires_at ?? null });

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
      notifyUser("Unable to share", result.error);
    }
  }

  async function openLink(share: PropertyShare) {
    if (busyKey) return;
    const key = `open:${share.share_token}`;
    shareAudit("12", { action: "Open Link invoked", shareRecordId: share.id, token: share.share_token });
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
      notifyUser("Unable to open", result.error);
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

  const previewSnapshot = buildSnapshotFromForm();
  const showItemPicker =
    permissions.sections.propertyPhotos ||
    permissions.sections.maintenanceHistory ||
    permissions.sections.upcomingMaintenance ||
    permissions.sections.completedRepairs ||
    permissions.sections.appliances ||
    permissions.sections.documents ||
    permissions.sections.warranties ||
    permissions.sections.receipts ||
    permissions.sections.inspectionReports ||
    permissions.sections.permits;

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
            Anyone with an active link can view only the sections you select.
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
                  Create a link and choose exactly which property details recipients can see.
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
                const preset =
                  parseSharePermissions(
                    typeof share.snapshot_json === "object" && share.snapshot_json
                      ? (share.snapshot_json as { permissions?: unknown }).permissions
                      : null
                  )?.preset;
                return (
                  <Card key={share.id}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>{share.label}</Text>
                      <AdminBadge label={share.is_active ? "Active" : "Inactive"} variant={share.is_active ? "success" : "muted"} />
                    </View>
                    <Text style={styles.muted}>{share.property_label}</Text>
                    {preset ? (
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                        Preset: {SHARE_PRESETS.find((p) => p.id === preset)?.label ?? preset}
                      </Text>
                    ) : null}
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

        <AdminFormModal
          visible={modalOpen}
          title={editing ? "Edit Share" : "New Share Link"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saving={saving}
        >
          <AdminField label="Link Label" value={label} onChangeText={setLabel} placeholder="Buyer Preview Link" />
          <AdminField label="Expires In (days)" value={expiresDays} onChangeText={setExpiresDays} keyboardType="numeric" placeholder="30" />
          <AdminField
            label="Owner Message (optional)"
            value={ownerMessage}
            onChangeText={setOwnerMessage}
            placeholder="A short note for viewers of this share"
            multiline
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Quick share presets</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {SHARE_PRESETS.map((p) => {
              const active = permissions.preset === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => applyPreset(p.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.bgSection,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : colors.textPrimary, fontWeight: "700", fontSize: 13 }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
            {SHARE_PRESETS.find((p) => p.id === permissions.preset)?.description}
          </Text>

          <Text style={[styles.label, { marginTop: 8 }]}>Choose what to share</Text>
          {SECTION_ORDER.map((key) => (
            <View key={key}>
              <AdminSwitch
                label={SHARE_SECTION_LABELS[key]}
                value={permissions.sections[key]}
                onValueChange={(v) => setSection(key, v)}
              />
              {SENSITIVE_SECTION_KEYS.includes(key) && !permissions.sections[key] ? (
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  Hidden by default
                </Text>
              ) : null}
            </View>
          ))}

          {showItemPicker ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>Select items</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                Section toggles alone are not enough — pick individual records to include.
              </Text>

              {(permissions.sections.maintenanceHistory || permissions.sections.upcomingMaintenance) ? (
                <ItemPicker
                  title="Maintenance"
                  items={catalog.maintenance}
                  selected={permissions.itemIds.maintenance}
                  onChange={(ids) =>
                    setPermissions((prev) => ({
                      ...prev,
                      preset: "custom",
                      itemIds: { ...prev.itemIds, maintenance: ids },
                    }))
                  }
                />
              ) : null}
              {permissions.sections.completedRepairs ? (
                <ItemPicker
                  title="Repairs"
                  items={catalog.repairs}
                  selected={permissions.itemIds.repairs}
                  onChange={(ids) =>
                    setPermissions((prev) => ({
                      ...prev,
                      preset: "custom",
                      itemIds: { ...prev.itemIds, repairs: ids },
                    }))
                  }
                />
              ) : null}
              {permissions.sections.appliances ? (
                <ItemPicker
                  title="Appliances"
                  items={catalog.appliances}
                  selected={permissions.itemIds.appliances}
                  onChange={(ids) =>
                    setPermissions((prev) => ({
                      ...prev,
                      preset: "custom",
                      itemIds: { ...prev.itemIds, appliances: ids },
                    }))
                  }
                />
              ) : null}
              {permissions.sections.propertyPhotos ? (
                <ItemPicker
                  title="Photos"
                  items={catalog.photos}
                  selected={permissions.itemIds.photos}
                  onChange={(ids) =>
                    setPermissions((prev) => ({
                      ...prev,
                      preset: "custom",
                      itemIds: { ...prev.itemIds, photos: ids },
                    }))
                  }
                />
              ) : null}
              {(permissions.sections.documents ||
                permissions.sections.warranties ||
                permissions.sections.receipts ||
                permissions.sections.inspectionReports ||
                permissions.sections.permits) ? (
                <ItemPicker
                  title="Documents"
                  items={catalog.documents}
                  selected={permissions.itemIds.documents}
                  onChange={(ids) =>
                    setPermissions((prev) => ({
                      ...prev,
                      preset: "custom",
                      itemIds: { ...prev.itemIds, documents: ids },
                    }))
                  }
                />
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={[styles.secondaryButton, { marginTop: 16 }]}
            onPress={() => {
              if (!hasAnyShareSelection(permissions, ownerMessage)) {
                notifyUser("Choose content", "Choose at least one item to share.");
                return;
              }
              setPreviewOpen(true);
            }}
          >
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Preview Shared Report</Text>
          </Pressable>

          {editing ? (
            <Pressable style={[styles.ghostButton, { marginTop: 8 }]} onPress={() => void handleRegenerate()}>
              <Text style={[styles.ghostButtonText, { color: colors.danger }]}>Regenerate link</Text>
            </Pressable>
          ) : null}
        </AdminFormModal>

        <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
          <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === "ios" ? 48 : 16 }}>
            <View style={[styles.rowBetween, { paddingHorizontal: 16, marginBottom: 8 }]}>
              <Text style={styles.modalTitle}>Preview Shared Report</Text>
              <Pressable onPress={() => setPreviewOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {previewSnapshot ? (
                <ShareReportView
                  snapshot={previewSnapshot}
                  propertyLabel={selectedProperty?.nickname || selectedProperty?.address}
                  previewBanner
                />
              ) : null}
              <Pressable
                style={[styles.secondaryButton, { marginTop: 16 }]}
                onPress={() => setPreviewOpen(false)}
              >
                <Text style={styles.secondaryButtonText}>Back to edit</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, { marginTop: 8 }, saving && { opacity: 0.7 }]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{editing ? "Save changes" : "Create share link"}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </Modal>
      </PremiumGate>
    </Screen>
  );
}

function ItemPicker({
  title,
  items,
  selected,
  onChange,
}: {
  title: string;
  items: ItemRow[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <View style={{ marginBottom: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
      <View style={styles.rowBetween}>
        <Text style={{ fontWeight: "800", color: colors.textPrimary }}>{title}</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable onPress={() => onChange(items.map((i) => i.id))}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>Select All</Text>
          </Pressable>
          <Pressable onPress={() => onChange([])}>
            <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 12 }}>Clear All</Text>
          </Pressable>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>No items</Text>
      ) : (
        items.map((item) => {
          const on = selectedSet.has(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(toggleItemId(selected, item.id, !on))}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderLight,
              }}
            >
              <Ionicons
                name={on ? "checkbox" : "square-outline"}
                size={22}
                color={on ? colors.primary : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  {[item.category, item.date].filter(Boolean).join(" · ")}
                  {on ? " · Selected" : ""}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

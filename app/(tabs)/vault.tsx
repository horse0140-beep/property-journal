import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
  Share,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";
import { useLocalSearchParams, router } from "expo-router";
import * as Sharing from "expo-sharing";
import { KeyboardModal } from "@/components/KeyboardModal";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingView } from "@/components/LoadingView";
import { ErrorCard } from "@/components/ErrorCard";
import { colors, styles } from "@/constants/theme";
import { useTabScrollContentStyle } from "@/constants/layout";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useUpgrade } from "@/context/UpgradeContext";
import type { Document } from "@/context/HomeWiseContext";
import { fileExists } from "@/lib/fileUtils";
import { logDocumentCardTap, resolveDocumentUrl } from "@/lib/documentUtils";
import { showRealSaveError, logSaveSuccessEvent } from "@/lib/realSaveError";
import { formatDateForDisplay, normalizeDateForDatabase } from "@/lib/dateForDatabase";
import { matchesPropertyId, normalizeDocumentCategory } from "@/types/database";
import { TabScreenHeader } from "@/components/TabScreenHeader";
import {
  isRemoteUri,
  pickCameraForUpload,
  pickDocumentForUpload,
  pickImageForUpload,
  type UploadProgress,
} from "@/services/storageService";

type Tab = "all" | "warranty" | "insurance" | "inspection" | "receipt" | "permit";
type DocCategory = Document["category"];

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "folder" },
  { key: "warranty", label: "Warranties", icon: "shield-checkmark" },
  { key: "insurance", label: "Insurance", icon: "umbrella" },
  { key: "inspection", label: "Inspection", icon: "clipboard" },
  { key: "receipt", label: "Receipts", icon: "receipt" },
  { key: "permit", label: "Permits", icon: "document-text" },
];

const DOC_CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: "warranty", label: "Warranty" },
  { value: "insurance", label: "Insurance" },
  { value: "inspection", label: "Inspection" },
  { value: "receipt", label: "Receipt" },
  { value: "permit", label: "Permit" },
  { value: "contract", label: "Contract" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];

function categoryIcon(cat: DocCategory) {
  const map: Record<DocCategory, { icon: string; bg: string; color: string }> = {
    warranty: { icon: "shield-checkmark", bg: "#EEF4FF", color: colors.primary },
    insurance: { icon: "umbrella", bg: "#F0FFF4", color: colors.success },
    inspection: { icon: "clipboard", bg: "#FEF3C7", color: colors.warning },
    receipt: { icon: "receipt", bg: "#FEE2E2", color: colors.danger },
    permit: { icon: "document-text", bg: "#EEF4FF", color: colors.accent },
    contract: { icon: "reader", bg: "#F5F0FF", color: "#7C3AED" },
    manual: { icon: "book", bg: "#F0F9FF", color: colors.info },
    other: { icon: "document", bg: colors.bgSection, color: colors.textMuted },
  };
  return map[cat] ?? map.other;
}

const EMPTY_FORM: Omit<Document, "id"> = {
  propertyId: "",
  title: "",
  category: "other",
  fileType: "pdf",
  fileSize: "—",
  uploadDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  notes: "",
  tags: [],
  expiresDate: "",
};

function progressLabel(progress: UploadProgress | null): string {
  if (!progress) return "";
  if (progress.phase === "picking") return "Selecting file…";
  if (progress.phase === "reading") return "Reading file…";
  if (progress.phase === "uploading") return `Uploading… ${progress.percent}%`;
  return "Upload complete";
}

export default function VaultScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const vaultTabs: Tab[] = ["all", "warranty", "insurance", "inspection", "receipt", "permit"];
  const { selectedProperty, documents, addDocument, deleteDocument, isLoading, loadError, refreshData } =
    useHomeWise();
  const { canAccess, showUpgrade } = useUpgrade();
  const tabScrollStyle = useTabScrollContentStyle();
  const [tab, setTab] = useState<Tab>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Omit<Document, "id">>({ ...EMPTY_FORM });
  const [tagInput, setTagInput] = useState("");
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [viewDocument, setViewDocument] = useState<Document | null>(null);

  const pid = selectedProperty?.id ?? "";

  useEffect(() => {
    if (tabParam && vaultTabs.includes(tabParam as Tab)) {
      setTab(tabParam as Tab);
    }
  }, [tabParam]);

  function setF(key: string, val: unknown) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function onUploadProgress(p: UploadProgress) {
    setUploadProgress(p);
  }

  async function attachPicked(
    picker: () => Promise<{ localUri: string; name: string; formattedSize: string; fileType: "pdf" | "image" | "other"; mimeType?: string } | null>
  ) {
    setPicking(true);
    setUploadProgress({ phase: "picking", percent: 5 });
    try {
      const result = await picker();
      if (result) {
        setPickedFileName(result.name);
        setF("fileUri", result.localUri);
        setF("fileSize", result.formattedSize);
        setF("fileType", result.fileType);
        if (!form.title.trim()) {
          setF("title", result.name.replace(/\.[^/.]+$/, ""));
        }
      }
    } catch (e) {
      console.warn("FILE_PICK_ERROR", e);
      showRealSaveError("vault", "pick file", e);
    } finally {
      setPicking(false);
      setUploadProgress(null);
    }
  }

  async function handlePickDocument() {
    await attachPicked(() => pickDocumentForUpload(onUploadProgress));
  }

  async function handlePickImage() {
    await attachPicked(() => pickImageForUpload(onUploadProgress));
  }

  async function handlePickCamera() {
    await attachPicked(() => pickCameraForUpload(onUploadProgress));
  }

  function openDocument(doc: Document) {
    logDocumentCardTap(doc);
    setViewDocument(doc);
  }

  async function handleOpen(doc: Document) {
    const url = resolveDocumentUrl(doc);
    if (!url) {
      Alert.alert("No File", "No file is attached to this document.");
      return;
    }

    if (isRemoteUri(url)) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
          Alert.alert("Cannot Open", "This file cannot be opened on this device.");
          return;
        }
        await Linking.openURL(url);
      } catch (e) {
        Alert.alert("Open Failed", e instanceof Error ? e.message : "Could not open file.");
      }
      return;
    }

    const exists = await fileExists(url);
    if (!exists) {
      Alert.alert("File Not Found", "The file could not be found on this device.");
      return;
    }
    await Linking.openURL(url);
  }

  async function handleShare(doc: Document) {
    const url = resolveDocumentUrl(doc);
    if (!url) {
      Alert.alert("No File", "No file is attached to this document.");
      return;
    }

    if (isRemoteUri(url)) {
      try {
        await Share.share({
          message: url,
          url: Platform.OS === "ios" ? url : undefined,
          title: doc.title,
        });
      } catch {
        // user dismissed share sheet
      }
      return;
    }

    const exists = await fileExists(url);
    if (!exists) {
      Alert.alert("File Not Found", "The file could not be found on this device.");
      return;
    }
    await Sharing.shareAsync(url, { dialogTitle: `Share ${doc.title}` });
  }

  function addTag() {
    if (!tagInput.trim()) return;
    setF("tags", [...(form.tags ?? []), tagInput.trim().toLowerCase()]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setF("tags", (form.tags ?? []).filter((x: string) => x !== t));
  }

  async function save() {
    if (savingRef.current || saving) return;

    if (!form.title.trim()) {
      Alert.alert("Required", "Please enter a document title.");
      return;
    }

    if (!form.fileUri?.trim()) {
      Alert.alert("File Required", "Please choose a file first.");
      return;
    }

    const expiresCheck = normalizeDateForDatabase(form.expiresDate);
    if (!expiresCheck.ok) {
      Alert.alert("Invalid Expiration Date", expiresCheck.error);
      return;
    }

    const needsCloudUpload = form.fileUri && !isRemoteUri(form.fileUri);
    if (needsCloudUpload && !canAccess("cloud_backup")) {
      showUpgrade("cloud_backup");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setUploadProgress({ phase: "uploading", percent: 10 });

    try {
      const saved = await addDocument({ ...form, propertyId: pid });
      logSaveSuccessEvent("vault", "save document", saved);
      await refreshData().catch((e) => console.warn("REFRESH_AFTER_SAVE_FAILED", e));
      setForm({ ...EMPTY_FORM });
      setTagInput("");
      setPickedFileName(null);
      setShowAdd(false);
    } catch (e) {
      showRealSaveError("vault", "save document", e);
    } finally {
      savingRef.current = false;
      setSaving(false);
      setUploadProgress(null);
    }
  }

  const propDocs = documents.filter((d) => matchesPropertyId(d.propertyId, pid));
  const filtered =
    tab === "all"
      ? propDocs
      : propDocs.filter((d) => normalizeDocumentCategory(d.category) === tab);
  const expiringSoon = propDocs.filter(
    (d) => d.expiresDate && normalizeDocumentCategory(d.category) === "warranty"
  );
  const busy = picking || saving;
  const canSaveDoc = Boolean(form.title.trim() && form.fileUri?.trim());

  if (isLoading) {
    return (
      <Screen noPad tabScreen>
        <LoadingView message="Loading vault…" />
      </Screen>
    );
  }

  if (!selectedProperty) {
    return (
      <Screen noPad tabScreen>
        <EmptyState
          icon="folder-open-outline"
          title="No property selected"
          message="Select a property to store warranties, receipts, and documents."
        />
      </Screen>
    );
  }

  return (
    <Screen noPad tabScreen>
      <TabScreenHeader>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.tabHeaderTitle}>Document Vault</Text>
            <Text style={styles.tabHeaderSubtitle}>
              {propDocs.length} {propDocs.length === 1 ? "document" : "documents"} for this property
            </Text>
          </View>
          {selectedProperty ? (
            <Pressable
              onPress={() => router.push(`/properties/${pid}?section=documents`)}
              style={[styles.secondaryButton, { marginTop: 0, paddingVertical: 9, paddingHorizontal: 12 }]}
            >
              <Text style={styles.secondaryButtonText}>Manage</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ gap: 6 }}
        >
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: tab === t.key ? colors.primary : colors.bgSection,
                borderWidth: 1,
                borderColor: tab === t.key ? colors.primary : colors.border,
              }}
            >
              <Ionicons
                name={t.icon as keyof typeof Ionicons.glyphMap}
                size={13}
                color={tab === t.key ? "#fff" : colors.textMuted}
              />
              <Text
                style={{
                  color: tab === t.key ? "#fff" : colors.textSecondary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </TabScreenHeader>

      <ScrollView contentContainerStyle={tabScrollStyle}>
        {loadError ? <ErrorCard message={loadError} onRetry={refreshData} /> : null}
        <View style={{ height: 12 }} />

        {expiringSoon.length > 0 && (
          <View
            style={{
              backgroundColor: colors.warningBg,
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: "#FDE68A",
            }}
          >
            <Ionicons name="warning" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.warning, fontWeight: "800", fontSize: 13 }}>
                {expiringSoon.length} {expiringSoon.length === 1 ? "Warranty" : "Warranties"} Expiring Soon
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                Review and renew before they expire
              </Text>
            </View>
          </View>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title={tab === "all" ? "Vault is empty" : `No ${tab} documents`}
            message="Add documents from your property record."
            actionLabel="Open Property Record"
            onAction={() => selectedProperty && router.push(`/properties/${pid}?section=documents`)}
          />
        ) : (
          filtered.map((doc) => {
            const ci = categoryIcon(doc.category);
            return (
              <Card key={doc.id}>
                <Pressable onPress={() => openDocument(doc)} accessibilityRole="button">
                  <View style={styles.rowBetween}>
                    <View style={[styles.rowStart, { flex: 1 }]}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: ci.bg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name={ci.icon as keyof typeof Ionicons.glyphMap} size={22} color={ci.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {doc.title}
                        </Text>
                        <Text style={styles.muted}>
                          {formatDateForDisplay(doc.uploadDate)} • {doc.fileType.toUpperCase()} • {doc.fileSize}
                        </Text>
                        {doc.expiresDate && (
                          <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                            Expires: {formatDateForDisplay(doc.expiresDate)}
                          </Text>
                        )}
                        {doc.fileUri && isRemoteUri(doc.fileUri) && (
                          <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                            Cloud synced
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={{ backgroundColor: ci.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                      <Text style={{ color: ci.color, fontSize: 11, fontWeight: "700" }}>
                        {doc.category.charAt(0).toUpperCase() + doc.category.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {doc.notes ? <Text style={[styles.muted, { marginTop: 8 }]}>{doc.notes}</Text> : null}

                  {(doc.tags ?? []).length > 0 && (
                    <View style={[styles.chipRow, { marginTop: 8 }]}>
                      {(doc.tags ?? []).map((tag: string) => (
                        <View
                          key={tag}
                          style={{
                            backgroundColor: colors.bgSection,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>

                <View style={[styles.divider, { marginTop: 10 }]} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => handleOpen(doc)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingVertical: 10,
                      backgroundColor: colors.bgSection,
                      borderRadius: 10,
                    }}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>View</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingVertical: 10,
                      backgroundColor: colors.bgSection,
                      borderRadius: 10,
                    }}
                    onPress={() => handleShare(doc)}
                  >
                    <Ionicons name="share-outline" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Share</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert("Delete", `Remove "${doc.title}"?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deleteDocument(doc.id) },
                      ])
                    }
                    style={{
                      paddingHorizontal: 14,
                      backgroundColor: colors.dangerBg,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <KeyboardModal visible={showAdd} onRequestClose={() => !busy && setShowAdd(false)}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Add Document</Text>
              <Pressable onPress={() => !busy && setShowAdd(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.label}>Document Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HVAC Warranty"
              placeholderTextColor={colors.textMuted}
              value={form.title}
              onChangeText={(v) => setF("title", v)}
            />

            <Text style={styles.label}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DOC_CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  style={[styles.chip, form.category === c.value && styles.chipActive]}
                  onPress={() => setF("category", c.value)}
                >
                  <Text style={form.category === c.value ? styles.chipTextActive : styles.chipText}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Expiration Date (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Jun 2031"
              placeholderTextColor={colors.textMuted}
              value={form.expiresDate}
              onChangeText={(v) => setF("expiresDate", v)}
            />

            <Text style={styles.label}>File Type</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["pdf", "image", "other"] as const).map((ft) => (
                <Pressable
                  key={ft}
                  style={[styles.chip, form.fileType === ft && styles.chipActive, { flex: 1 }]}
                  onPress={() => setF("fileType", ft)}
                >
                  <Text
                    style={[
                      { textAlign: "center" },
                      form.fileType === ft ? styles.chipTextActive : styles.chipText,
                    ]}
                  >
                    {ft.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Policy #, coverage details, etc."
              placeholderTextColor={colors.textMuted}
              value={form.notes}
              onChangeText={(v) => setF("notes", v)}
              multiline
            />

            <Text style={styles.label}>Tags</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add tag..."
                placeholderTextColor={colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <Pressable
                onPress={addTag}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
            </View>
            {(form.tags ?? []).length > 0 && (
              <View style={[styles.chipRow, { marginTop: 8 }]}>
                {(form.tags ?? []).map((t: string) => (
                  <Pressable key={t} onPress={() => removeTag(t)} style={styles.chipActive}>
                    <Text style={styles.chipTextActive}>#{t} ✕</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>Attach File</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <Pressable
                onPress={handlePickDocument}
                disabled={busy}
                style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: busy ? 0.6 : 1 }]}
              >
                <Ionicons name="document-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Document</Text>
              </Pressable>
              <Pressable
                onPress={handlePickImage}
                disabled={busy}
                style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: busy ? 0.6 : 1 }]}
              >
                <Ionicons name="image-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Photo</Text>
              </Pressable>
              <Pressable
                onPress={handlePickCamera}
                disabled={busy}
                style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: busy ? 0.6 : 1 }]}
              >
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Camera</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handlePickDocument}
              disabled={busy}
              style={{
                backgroundColor: colors.bgSection,
                borderRadius: 12,
                padding: 16,
                marginTop: 4,
                borderWidth: 1,
                borderColor: pickedFileName ? colors.success : colors.border,
                borderStyle: pickedFileName ? "solid" : "dashed",
                alignItems: "center",
                gap: 8,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? (
                <>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    {progressLabel(uploadProgress) || "Working…"}
                  </Text>
                </>
              ) : pickedFileName ? (
                <>
                  {form.fileType === "image" && form.fileUri ? (
                    <Image
                      source={{ uri: form.fileUri }}
                      style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 8 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                  )}
                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>{pickedFileName}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {form.fileSize} · Tap buttons above to change file
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={28} color={colors.textMuted} />
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>No file attached</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
                    PDF, image, or document from your device
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.primaryButton, (busy || !canSaveDoc) && { opacity: 0.7 }]}
              onPress={save}
              disabled={busy || !canSaveDoc}
            >
              {saving ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryButtonText}>
                    {progressLabel(uploadProgress) || "Saving…"}
                  </Text>
                </>
              ) : (
                <Text style={styles.primaryButtonText}>Save Document</Text>
              )}
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => !busy && setShowAdd(false)}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
            <View style={{ height: 20 }} />
      </KeyboardModal>

      <DocumentViewerModal
        visible={viewDocument !== null}
        document={viewDocument}
        onClose={() => setViewDocument(null)}
        onDelete={deleteDocument}
      />
    </Screen>
  );
}

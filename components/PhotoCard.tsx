import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, styles } from "@/constants/theme";
import {
  hasDisplayablePhotoUrl,
  resolvePhotoDisplayUrl,
} from "@/lib/photoUtils";
import { auditPipelineStep } from "@/lib/photoUploadAudit";
import { PHOTO_CATEGORIES } from "@/components/property/propertyDetailConstants";
import type { PhotoItem } from "@/data/demoData";
import { notifyUser, confirmDestructive } from "@/lib/userFeedback";
import { formatDateForDisplay } from "@/lib/dateForDatabase";

type PhotoCardProps = {
  photo: PhotoItem | Record<string, unknown>;
  size: number;
  /** Delete the photo record (and storage). Confirmation is handled inside PhotoCard. */
  onDelete?: () => void | Promise<void>;
  onUpdatePhoto?: (id: string, updates: { caption: string; category: string }) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  /** Open the full-screen viewer once the image is ready (deep-link from Home). */
  autoOpen?: boolean;
  onAutoOpened?: () => void;
};

export function PhotoCard({
  photo,
  size,
  onDelete,
  onUpdatePhoto,
  style,
  imageStyle,
  autoOpen,
  onAutoOpened,
}: PhotoCardProps) {
  const insets = useSafeAreaInsets();
  const [displayUrl, setDisplayUrl] = useState("");
  const [resolving, setResolving] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editCategory, setEditCategory] = useState("Exterior");
  const [deleting, setDeleting] = useState(false);

  const record = photo as Record<string, unknown>;
  const photoId = String(record.id ?? "");
  const caption = String(record.caption ?? "").trim();
  const category = String(record.category ?? "").trim();
  const uploadedDate = String(record.date ?? record.created_at ?? record.createdAt ?? "").trim();
  const uploadedDisplay = uploadedDate
    ? formatDateForDisplay(uploadedDate) || uploadedDate
    : "";

  useEffect(() => {
    let cancelled = false;

    setResolving(true);
    setLoadError(false);

    void resolvePhotoDisplayUrl(photo).then((url) => {
      if (cancelled) return;
      auditPipelineStep(12, { displayUrl: url, photoId: record.id ?? null });
      console.log("[PHOTOCARD URI]", url);
      setDisplayUrl(url);
      setResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [photo]);

  useEffect(() => {
    setEditCaption(caption);
    setEditCategory(category || "Exterior");
  }, [caption, category, viewerOpen]);

  const showImage = !resolving && !loadError && hasDisplayablePhotoUrl(displayUrl);

  useEffect(() => {
    if (!autoOpen || !showImage || viewerOpen) return;
    setEditing(false);
    setViewerOpen(true);
    onAutoOpened?.();
  }, [autoOpen, showImage, viewerOpen, onAutoOpened]);

  function openViewer() {
    if (!showImage) return;
    setEditing(false);
    setViewerOpen(true);
  }

  function closeViewer() {
    setEditing(false);
    setViewerOpen(false);
  }

  function startEdit() {
    setEditCaption(caption);
    setEditCategory(category || "Exterior");
    setEditing(true);
  }

  async function saveEdits() {
    if (!onUpdatePhoto || !photoId) return;
    setSaving(true);
    try {
      await onUpdatePhoto(photoId, {
        caption: editCaption.trim(),
        category: editCategory,
      });
      setEditing(false);
      notifyUser("Photo updated", "Category and description saved.");
    } catch (e) {
      notifyUser("Save Failed", e instanceof Error ? e.message : "Could not save photo details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || deleting) return;
    const ok = await confirmDestructive("Delete Photo", "Remove this photo from the property?");
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete();
      closeViewer();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete this photo.";
      // DB already deleted — keep viewer closed and warn about storage cleanup.
      if (/cleanup failed|removed from your records/i.test(msg)) {
        closeViewer();
        notifyUser("Photo deleted", msg);
      } else {
        notifyUser("Delete Failed", msg);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={openViewer}
        disabled={!showImage}
        style={[
          {
            width: size,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: colors.bgCard,
            borderWidth: 1,
            borderColor: colors.border,
          },
          style,
        ]}
      >
        <View style={{ width: size, height: size, backgroundColor: colors.bgSection }}>
          {resolving ? (
            <View
              style={{
                width: size,
                height: size,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : showImage ? (
            <Image
              source={{ uri: displayUrl }}
              style={[{ width: size, height: size }, imageStyle]}
              resizeMode="cover"
              onError={() => setLoadError(true)}
            />
          ) : (
            <View
              style={{
                width: size,
                height: size,
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
              }}
            >
              <Ionicons name="image-outline" size={28} color={colors.textMuted} />
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                No preview available
              </Text>
            </View>
          )}
        </View>

        {caption || category ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            {caption ? (
              <Text
                style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}
                numberOfLines={1}
              >
                {caption}
              </Text>
            ) : null}
            {category ? (
              <Text
                style={{ color: colors.textMuted, fontSize: 10, marginTop: caption ? 2 : 0 }}
                numberOfLines={1}
              >
                {category}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      <Modal visible={viewerOpen} animationType="fade" transparent onRequestClose={closeViewer}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
            <Pressable
              onPress={closeViewer}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 4,
              }}
            >
              <Ionicons name="close" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Close</Text>
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              {onUpdatePhoto && !editing ? (
                <Pressable
                  onPress={startEdit}
                  disabled={deleting}
                  style={{ paddingVertical: 8, paddingHorizontal: 4 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>Edit</Text>
                </Pressable>
              ) : null}

              {onDelete && !editing ? (
                <Pressable
                  onPress={() => {
                    void handleDelete();
                  }}
                  disabled={deleting}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 16 }}>Delete</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>

          {editing ? (
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Caption</Text>
              <TextInput
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: 12,
                  color: "#fff",
                  marginBottom: 16,
                }}
                placeholder="Optional caption"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={editCaption}
                onChangeText={setEditCaption}
              />
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {PHOTO_CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.chip,
                      editCategory === c && styles.chipActive,
                      { borderColor: editCategory === c ? colors.primary : colors.border },
                    ]}
                    onPress={() => setEditCategory(c)}
                  >
                    <Text style={editCategory === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                style={[styles.primaryButton, { marginTop: 24 }, saving && { opacity: 0.6 }]}
                onPress={saveEdits}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save</Text>
                )}
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setEditing(false)} disabled={saving}>
                <Text style={[styles.ghostButtonText, { color: "#fff" }]}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                {showImage ? (
                  <Image
                    source={{ uri: displayUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={{ alignItems: "center", padding: 24 }}>
                    <Ionicons name="image-outline" size={48} color={colors.textMuted} />
                    <Text style={{ color: "#fff", fontSize: 16, marginTop: 12, textAlign: "center" }}>
                      No preview available
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 12, gap: 8 }}>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" }}>
                    CATEGORY
                  </Text>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                    {category || "Not set"}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" }}>
                    DESCRIPTION
                  </Text>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600", marginTop: 2 }}>
                    {caption || "No description"}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" }}>
                    UPLOADED
                  </Text>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600", marginTop: 2 }}>
                    {uploadedDisplay || "—"}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type PhotoCardProps = {
  photo: PhotoItem | Record<string, unknown>;
  size: number;
  onDelete?: () => void;
  onUpdatePhoto?: (id: string, updates: { caption: string; category: string }) => Promise<void>;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function PhotoCard({ photo, size, onDelete, onUpdatePhoto, style, imageStyle }: PhotoCardProps) {
  const insets = useSafeAreaInsets();
  const [displayUrl, setDisplayUrl] = useState("");
  const [resolving, setResolving] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editCategory, setEditCategory] = useState("Exterior");

  const record = photo as Record<string, unknown>;
  const photoId = String(record.id ?? "");
  const caption = String(record.caption ?? "").trim();
  const category = String(record.category ?? "").trim();

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
      closeViewer();
    } catch (e) {
      Alert.alert("Save Failed", e instanceof Error ? e.message : "Could not save photo details.");
    } finally {
      setSaving(false);
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
                <Pressable onPress={startEdit} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>Edit</Text>
                </Pressable>
              ) : null}

              {onDelete && !editing ? (
                <Pressable
                  onPress={() => {
                    closeViewer();
                    onDelete();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 16 }}>Delete</Text>
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

              {caption || category ? (
                <View style={{ marginTop: 12 }}>
                  {caption ? (
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
                      {caption}
                    </Text>
                  ) : null}
                  {category ? (
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4, textAlign: "center" }}>
                      {category}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

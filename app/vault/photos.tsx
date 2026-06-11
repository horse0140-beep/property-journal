import {
  ScrollView,
  Text,
  View,
  Pressable,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import {
  bucketForPropertyPhoto,
  pickCameraForUpload,
  pickImageForUpload,
  showUploadError,
  uploadLocalFileIfNeeded,
  isRemoteUri,
  type UploadProgress,
} from "@/services/storageService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMB_SIZE = (SCREEN_WIDTH - 48 - 8) / 3;

const CATEGORIES = [
  "Exterior",
  "Interior",
  "Roof",
  "HVAC",
  "Plumbing",
  "Kitchen",
  "Bathroom",
  "Garage",
  "Yard",
  "Repair",
  "Before",
  "After",
  "Other",
];

function progressLabel(progress: UploadProgress | null): string {
  if (!progress) return "Uploading…";
  if (progress.phase === "reading") return "Reading photo…";
  if (progress.phase === "uploading") return `Uploading… ${progress.percent}%`;
  if (progress.phase === "complete") return "Upload complete";
  return "Preparing…";
}

export default function PhotosScreen() {
  const { selectedProperty, photos, addPhoto, deletePhoto } = useHomeWise();
  const { user } = useAuth();
  const { canAccess, showUpgrade } = useUpgrade();
  const pid = selectedProperty?.id ?? "";
  const propPhotos = photos.filter((p) => p.propertyId === pid);

  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Exterior");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("All");

  async function handlePickLibrary() {
    setPicking(true);
    try {
      const picked = await pickImageForUpload((p) => setUploadProgress(p));
      if (picked) {
        setPendingUri(picked.localUri);
        setShowAdd(true);
      }
    } catch (e) {
      showUploadError(e, "Photo Selection Failed");
    } finally {
      setPicking(false);
      setUploadProgress(null);
    }
  }

  async function handleCamera() {
    setPicking(true);
    try {
      const picked = await pickCameraForUpload((p) => setUploadProgress(p));
      if (picked) {
        setPendingUri(picked.localUri);
        setShowAdd(true);
      }
    } catch (e) {
      showUploadError(e, "Camera Failed");
    } finally {
      setPicking(false);
      setUploadProgress(null);
    }
  }

  async function savePhoto() {
    if (!pendingUri) return;

    if (!user?.id) {
      Alert.alert("Sign In Required", "Please sign in to upload photos to the cloud.");
      return;
    }

    if (!canAccess("cloud_backup")) {
      showUpgrade("cloud_backup");
      return;
    }

    setSaving(true);
    setUploadProgress({ phase: "uploading", percent: 10 });

    try {
      const remoteUri = await uploadLocalFileIfNeeded(
        user.id,
        bucketForPropertyPhoto(),
        pendingUri,
        undefined,
        (p) => setUploadProgress(p)
      );

      addPhoto({
        propertyId: pid,
        uri: remoteUri ?? pendingUri,
        caption: caption.trim() || category,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        category,
      });

      setPendingUri(null);
      setCaption("");
      setCategory("Exterior");
      setShowAdd(false);
    } catch (e) {
      showUploadError(e);
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete Photo", "Remove this photo from HomeWise?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deletePhoto(id);
          setSelectedPhoto(null);
        },
      },
    ]);
  }

  const filteredPhotos =
    filterCat === "All" ? propPhotos : propPhotos.filter((p) => p.category === filterCat);

  const usedCategories = ["All", ...Array.from(new Set(propPhotos.map((p) => p.category)))];
  const busy = picking || saving;

  return (
    <Screen noPad>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.bgCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>Photo Timeline</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{propPhotos.length} photos</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={handleCamera}
            disabled={busy}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.bgSection,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={handlePickLibrary}
            disabled={busy}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {picking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      {propPhotos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        >
          {usedCategories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setFilterCat(cat)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: filterCat === cat ? colors.primary : colors.bgSection,
                borderWidth: 1,
                borderColor: filterCat === cat ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  color: filterCat === cat ? "#fff" : colors.textSecondary,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {propPhotos.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.bgSection,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="images-outline" size={38} color={colors.textMuted} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>No photos yet</Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 14,
                textAlign: "center",
                marginTop: 8,
                lineHeight: 22,
              }}
            >
              Document your home's condition over time with photos.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <Pressable
                onPress={handleCamera}
                disabled={busy}
                style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: busy ? 0.6 : 1 }]}
              >
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Camera</Text>
              </Pressable>
              <Pressable
                onPress={handlePickLibrary}
                disabled={busy}
                style={[styles.primaryButton, { flex: 1, marginTop: 0, opacity: busy ? 0.6 : 1 }]}
              >
                <Ionicons name="images-outline" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Library</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {filteredPhotos.map((photo) => (
              <Pressable key={photo.id} onPress={() => setSelectedPhoto(photo.id)}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10 }}
                  resizeMode="cover"
                />
                {photo.caption ? (
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, maxWidth: THUMB_SIZE }}
                  >
                    {photo.caption}
                  </Text>
                ) : null}
                {isRemoteUri(photo.uri) && (
                  <Ionicons
                    name="cloud-done-outline"
                    size={12}
                    color={colors.success}
                    style={{ marginTop: 2 }}
                  />
                )}
              </Pressable>
            ))}

            <Pressable
              onPress={handlePickLibrary}
              disabled={busy}
              style={{
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: 10,
                backgroundColor: colors.bgSection,
                borderWidth: 2,
                borderColor: colors.border,
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {picking ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="add" size={28} color={colors.textMuted} />
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 34 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Photo</Text>
            {pendingUri && (
              <Image
                source={{ uri: pendingUri }}
                style={{ width: "100%", height: 200, borderRadius: 12, marginBottom: 16 }}
                resizeMode="cover"
              />
            )}
            <Text style={styles.label}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chipRow, { marginBottom: 8 }]}
            >
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={category === c ? styles.chipActive : styles.chip}
                  onPress={() => setCategory(c)}
                >
                  <Text style={category === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Caption (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Roof after repair, May 2026"
              placeholderTextColor={colors.textMuted}
              value={caption}
              onChangeText={setCaption}
            />
            <Pressable
              style={[styles.primaryButton, saving && { opacity: 0.7 }]}
              onPress={savePhoto}
              disabled={saving}
            >
              {saving ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryButtonText}>{progressLabel(uploadProgress)}</Text>
                </>
              ) : (
                <Text style={styles.primaryButtonText}>Save Photo</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.ghostButton}
              onPress={() => {
                if (!saving) {
                  setShowAdd(false);
                  setPendingUri(null);
                }
              }}
            >
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedPhoto} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" }}>
          {selectedPhoto &&
            (() => {
              const photo = propPhotos.find((p) => p.id === selectedPhoto);
              if (!photo) return null;
              return (
                <>
                  <Pressable
                    onPress={() => setSelectedPhoto(null)}
                    style={{
                      position: "absolute",
                      top: 56,
                      right: 20,
                      zIndex: 10,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: "rgba(255,255,255,0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={22} color="#fff" />
                  </Pressable>
                  <Image source={{ uri: photo.uri }} style={{ width: "100%", height: 400 }} resizeMode="contain" />
                  <View style={{ padding: 20 }}>
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{photo.caption}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 }}>
                      {photo.date} · {photo.category}
                    </Text>
                    <Pressable
                      onPress={() => confirmDelete(photo.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 20,
                        backgroundColor: "rgba(220,38,38,0.2)",
                        padding: 14,
                        borderRadius: 12,
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      <Text style={{ color: colors.danger, fontWeight: "700" }}>Delete Photo</Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}
        </View>
      </Modal>
    </Screen>
  );
}

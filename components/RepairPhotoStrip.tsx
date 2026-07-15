import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { resolveRepairPhotoUrl } from "@/lib/repairPhotos";

const THUMB = 64;

type RepairPhotoStripProps = {
  /** Stored repair photo URLs (repairs.photo_urls). */
  urls: string[];
  onDeletePhoto?: (storedUrl: string) => void;
};

function RepairPhotoThumb({
  storedUrl,
  onDelete,
}: {
  storedUrl: string;
  onDelete?: (storedUrl: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [displayUrl, setDisplayUrl] = useState("");
  const [resolving, setResolving] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setLoadError(false);

    void resolveRepairPhotoUrl(storedUrl).then((url) => {
      if (cancelled) return;
      setDisplayUrl(url);
      setResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  const displayable =
    displayUrl.startsWith("http") ||
    displayUrl.startsWith("file:") ||
    displayUrl.startsWith("content:");
  const showImage = !resolving && !loadError && displayable;

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert("Delete Photo", "Remove this repair photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setViewerOpen(false);
          onDelete(storedUrl);
        },
      },
    ]);
  }

  return (
    <>
      <Pressable
        onPress={() => showImage && setViewerOpen(true)}
        disabled={!showImage}
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: colors.bgSection,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {resolving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : showImage ? (
          <Image
            source={{ uri: displayUrl }}
            style={{ width: THUMB, height: THUMB }}
            resizeMode="cover"
            onError={(e) => {
              console.warn("[REPAIR PHOTO IMAGE ERROR]", {
                displayUrl,
                error: e.nativeEvent?.error,
              });
              setLoadError(true);
            }}
          />
        ) : (
          <View style={{ alignItems: "center", padding: 4 }}>
            <Ionicons name="image-outline" size={18} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 8, textAlign: "center" }}>
              No preview available
            </Text>
          </View>
        )}
      </Pressable>

      <Modal visible={viewerOpen} animationType="fade" transparent onRequestClose={() => setViewerOpen(false)}>
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
              onPress={() => setViewerOpen(false)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
            >
              <Ionicons name="close" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Close</Text>
            </Pressable>
            {onDelete ? (
              <Pressable
                onPress={confirmDelete}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 16 }}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Image
              source={{ uri: displayUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
              onError={(e) =>
                console.warn("[REPAIR PHOTO IMAGE ERROR]", {
                  displayUrl,
                  viewer: true,
                  error: e.nativeEvent?.error,
                })
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

export function RepairPhotoStrip({ urls, onDeletePhoto }: RepairPhotoStripProps) {
  const valid = (urls ?? []).filter((u) => (u ?? "").trim().length > 0);
  if (valid.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 8 }}
      contentContainerStyle={{ gap: 8 }}
    >
      {valid.map((url, i) => (
        <RepairPhotoThumb key={`${url}-${i}`} storedUrl={url} onDelete={onDeletePhoto} />
      ))}
    </ScrollView>
  );
}

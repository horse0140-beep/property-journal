import {
  Alert,
  Image,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardModal } from "@/components/KeyboardModal";
import { colors, styles } from "@/constants/theme";
import { formatDateForDisplay } from "@/lib/dateForDatabase";
import { openExternalUrl } from "@/lib/openExternalUrl";
import type { Document } from "@/data/demoData";
import {
  hasDocumentPreviewUrl,
  isImageDocument,
  isPdfDocument,
  documentUrlStatus,
  resolveDocumentUrl,
} from "@/lib/documentUtils";

type DocumentViewerModalProps = {
  visible: boolean;
  document: Document | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit?: () => void;
};

function categoryLabel(category: Document["category"]): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function DocumentViewerModal({
  visible,
  document,
  onClose,
  onDelete,
  onEdit,
}: DocumentViewerModalProps) {
  if (!document) {
    return null;
  }

  const doc = document;
  const resolvedUrl = resolveDocumentUrl(doc);
  const hasUrl = Boolean(resolvedUrl.trim());
  const urlStatus = documentUrlStatus(resolvedUrl);
  const canPreview = hasDocumentPreviewUrl(resolvedUrl);
  const showImagePreview = canPreview && isImageDocument(doc, resolvedUrl);
  const showPdfPreview = canPreview && isPdfDocument(doc, resolvedUrl);

  async function handleOpen() {
    if (!resolvedUrl) {
      Alert.alert("No File", "No file URL is available for this document.");
      return;
    }

    try {
      await openExternalUrl(resolvedUrl);
    } catch (e) {
      Alert.alert("Open Failed", e instanceof Error ? e.message : "Could not open file.");
    }
  }

  async function handleShare() {
    if (!resolvedUrl) {
      Alert.alert("No File", "No file URL is available to share.");
      return;
    }

    try {
      await Share.share({
        message: resolvedUrl,
        url: Platform.OS === "ios" ? resolvedUrl : undefined,
        title: doc.title,
      });
    } catch {
      // user dismissed share sheet
    }
  }

  function handleDelete() {
    Alert.alert("Delete", `Remove "${doc.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(doc.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <KeyboardModal visible={visible} onRequestClose={onClose}>
      <View style={styles.rowBetween}>
        <Text style={[styles.modalTitle, { flex: 1, marginRight: 12 }]} numberOfLines={2}>
          {doc.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {onEdit ? (
            <Pressable onPress={onEdit} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Edit</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.muted, { marginTop: 4 }]}>
        {categoryLabel(doc.category)} · {doc.fileType.toUpperCase()}
      </Text>
      <Text style={[styles.muted, { marginTop: 2 }]}>Uploaded {formatDateForDisplay(doc.uploadDate) || "—"}</Text>
      <Text
        style={[
          styles.muted,
          {
            marginTop: 6,
            fontWeight: "600",
            color: hasUrl ? colors.success : colors.textMuted,
          },
        ]}
      >
        {urlStatus}
      </Text>
      {doc.fileSize ? (
        <Text style={[styles.muted, { marginTop: 2 }]}>Size {doc.fileSize}</Text>
      ) : null}
      {doc.expiresDate ? (
        <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600", marginTop: 4 }}>
          Expires {formatDateForDisplay(doc.expiresDate)}
        </Text>
      ) : null}

      <View
        style={{
          marginTop: 16,
          marginBottom: 16,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.bgSection,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: 160,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showImagePreview ? (
          <Image
            source={{ uri: resolvedUrl }}
            style={{ width: "100%", height: 200 }}
            resizeMode="contain"
          />
        ) : showPdfPreview ? (
          <View style={{ alignItems: "center", padding: 24 }}>
            <Ionicons name="document-text-outline" size={48} color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600", marginTop: 12 }}>
              PDF document
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: "center" }}>
              Tap Open to view in your device viewer
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: "center", padding: 24 }}>
            <Ionicons name="document-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12, textAlign: "center" }}>
              {hasUrl ? "No file preview available" : "No file attached"}
            </Text>
          </View>
        )}
      </View>

      {doc.notes ? <Text style={[styles.muted, { marginBottom: 12 }]}>{doc.notes}</Text> : null}

      <Pressable
        style={[styles.primaryButton, !hasUrl && { opacity: 0.5 }]}
        onPress={handleOpen}
        disabled={!hasUrl}
      >
        <Text style={styles.primaryButtonText}>Open / View</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, !hasUrl && { opacity: 0.5 }]}
        onPress={handleShare}
        disabled={!hasUrl}
      >
        <Text style={styles.secondaryButtonText}>Share</Text>
      </Pressable>

      <Pressable style={[styles.secondaryButton, { borderColor: colors.danger }]} onPress={handleDelete}>
        <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Delete</Text>
      </Pressable>

      <Pressable style={styles.ghostButton} onPress={onClose}>
        <Text style={styles.ghostButtonText}>Close</Text>
      </Pressable>
      <View style={{ height: 20 }} />
    </KeyboardModal>
  );
}

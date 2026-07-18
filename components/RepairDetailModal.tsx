import { useEffect } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardModal } from "@/components/KeyboardModal";
import { RepairPhotoStrip } from "@/components/RepairPhotoStrip";
import { formatPickerDateDisplay, toIsoDateValue } from "@/components/DatePickerField";
import { colors, styles } from "@/constants/theme";
import type { Repair } from "@/data/demoData";

type RepairDetailModalProps = {
  visible: boolean;
  repair: Repair | null;
  onClose: () => void;
  onEdit: (repair: Repair) => void;
  onDelete: (id: string) => void;
  onDeletePhoto?: (repairId: string, storedUrl: string) => void;
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const text = String(value ?? "").trim();
  if (!text || text === "Not listed" || text === "Not recorded") return null;
  const iso = toIsoDateValue(text);
  const display = iso ? formatPickerDateDisplay(iso) : text;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>{display}</Text>
    </View>
  );
}

export function RepairDetailModal({
  visible,
  repair,
  onClose,
  onEdit,
  onDelete,
  onDeletePhoto,
}: RepairDetailModalProps) {
  useEffect(() => {
    if (visible && repair) {
      console.log("[RepairDetail] opened", { id: repair.id, title: repair.title });
    }
  }, [visible, repair?.id]);

  if (!repair) return null;

  function handleDelete() {
    Alert.alert("Delete Repair", `Remove "${repair!.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(repair!.id);
          onClose();
        },
      },
    ]);
  }

  const photos = repair.photoUris ?? [];

  return (
    <KeyboardModal visible={visible} onRequestClose={onClose}>
      <View style={styles.rowBetween}>
        <Text style={[styles.modalTitle, { flex: 1, marginRight: 12 }]} numberOfLines={2}>
          {repair.title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <DetailRow label="Category" value={repair.category} />
      <DetailRow label="Date" value={repair.date} />
      <DetailRow label="Cost" value={repair.cost ? `$${repair.cost}` : ""} />
      <DetailRow label="Contractor" value={repair.contractor} />
      <DetailRow label="Warranty Expires" value={repair.warrantyExpires} />

      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>Notes</Text>
        <Text
          style={{
            color: String(repair.notes ?? "").trim() ? colors.textPrimary : colors.textMuted,
            fontSize: 15,
            fontWeight: String(repair.notes ?? "").trim() ? "600" : "400",
            fontStyle: String(repair.notes ?? "").trim() ? "normal" : "italic",
          }}
        >
          {String(repair.notes ?? "").trim() || "No notes added."}
        </Text>
      </View>

      {photos.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Photos</Text>
          <RepairPhotoStrip
            urls={photos}
            onDeletePhoto={
              onDeletePhoto ? (url) => onDeletePhoto(repair.id, url) : undefined
            }
          />
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
          No photos attached
        </Text>
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          console.log("[RepairDetail] edit selected", { id: repair.id, title: repair.title });
          onEdit(repair);
        }}
      >
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Edit</Text>
      </Pressable>

      <Pressable style={[styles.secondaryButton, { marginTop: 10 }]} onPress={onClose}>
        <Text style={styles.secondaryButtonText}>Close</Text>
      </Pressable>

      <Pressable style={[styles.ghostButton, { marginTop: 4 }]} onPress={handleDelete}>
        <Text style={[styles.ghostButtonText, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </KeyboardModal>
  );
}

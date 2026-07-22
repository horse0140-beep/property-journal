import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardModal } from "@/components/KeyboardModal";
import { formatPickerDateDisplay, toIsoDateValue } from "@/components/DatePickerField";
import { colors, styles } from "@/constants/theme";
import type { MaintenanceItem } from "@/context/HomeWiseContext";
import { confirmDestructive } from "@/lib/userFeedback";
import { RepairPhotoStrip } from "@/components/RepairPhotoStrip";

type MaintenanceDetailModalProps = {
  visible: boolean;
  item: MaintenanceItem | null;
  onClose: () => void;
  onEdit: (item: MaintenanceItem) => void;
  /** Opens the completion workflow (date, notes, next-step choice). */
  onRequestComplete: (item: MaintenanceItem) => void;
  onDelete: (id: string) => void;
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const iso = toIsoDateValue(text);
  const display = iso ? formatPickerDateDisplay(iso) : text;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>{display}</Text>
    </View>
  );
}

function formatRecurring(item: MaintenanceItem): string {
  if (!item.recurring) return "One-time task";
  const days = item.intervalDays;
  if (!days) return "Recurring";
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? "Every year" : `Every ${years} years`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? "Every month" : `Every ${months} months`;
  }
  if (days % 7 === 0) {
    const weeks = days / 7;
    return weeks === 1 ? "Every week" : `Every ${weeks} weeks`;
  }
  return `Every ${days} days`;
}

function formatPriority(priority: MaintenanceItem["priority"]): string {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

export function MaintenanceDetailModal({
  visible,
  item,
  onClose,
  onEdit,
  onRequestComplete,
  onDelete,
}: MaintenanceDetailModalProps) {
  if (!item) return null;

  const notes = String(item.notes ?? "").trim();
  const canComplete = !item.archived && item.status !== "Completed";
  const photos = item.photoUris ?? [];

  async function handleDelete() {
    const ok = await confirmDestructive("Delete Task", `Remove "${item!.title}"?`);
    if (!ok) return;
    onDelete(item!.id);
    onClose();
  }

  return (
    <KeyboardModal visible={visible} onRequestClose={onClose}>
      <View style={styles.rowBetween}>
        <Text style={[styles.modalTitle, { flex: 1, marginRight: 12 }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <DetailRow label="Category" value={item.category} />
      <DetailRow
        label="Status"
        value={item.archived ? "Archived" : item.status}
      />
      <DetailRow label="Priority" value={formatPriority(item.priority)} />
      <DetailRow label="Next Due" value={item.nextDue || "—"} />
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>Last Completed</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
          {toIsoDateValue(item.lastCompleted)
            ? formatPickerDateDisplay(item.lastCompleted)
            : String(item.lastCompleted ?? "").trim() || "—"}
        </Text>
      </View>
      <DetailRow label="Schedule" value={formatRecurring(item)} />

      {photos.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Photos</Text>
          <RepairPhotoStrip urls={photos} />
        </View>
      ) : null}

      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>Notes</Text>
        <Text
          style={{
            color: notes ? colors.textPrimary : colors.textMuted,
            fontSize: 15,
            fontWeight: notes ? "600" : "400",
            fontStyle: notes ? "normal" : "italic",
          }}
        >
          {notes || "No notes added."}
        </Text>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          onEdit(item);
        }}
      >
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Edit</Text>
      </Pressable>

      {canComplete && !item.archived ? (
        <Pressable
          style={[styles.secondaryButton, { marginTop: 10 }]}
          onPress={() => {
            onClose();
            onRequestComplete(item);
          }}
        >
          <Text style={styles.secondaryButtonText}>Mark Complete</Text>
        </Pressable>
      ) : null}

      <Pressable style={[styles.secondaryButton, { marginTop: 10 }]} onPress={onClose}>
        <Text style={styles.secondaryButtonText}>Close</Text>
      </Pressable>

      <Pressable
        style={[styles.ghostButton, { marginTop: 4 }]}
        onPress={() => {
          void handleDelete();
        }}
      >
        <Text style={[styles.ghostButtonText, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </KeyboardModal>
  );
}

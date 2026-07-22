import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardModal } from "@/components/KeyboardModal";
import { formatPickerDateDisplay, toIsoDateValue } from "@/components/DatePickerField";
import { colors, styles } from "@/constants/theme";
import type { MaintenanceItem } from "@/context/HomeWiseContext";
import { confirmDestructive, notifyUser } from "@/lib/userFeedback";
import { RepairPhotoStrip } from "@/components/RepairPhotoStrip";

type MaintenanceDetailModalProps = {
  visible: boolean;
  item: MaintenanceItem | null;
  onClose: () => void;
  onEdit: (item: MaintenanceItem) => void;
  onComplete: (id: string) => Promise<MaintenanceItem | null | void>;
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
  onComplete,
  onDelete,
}: MaintenanceDetailModalProps) {
  const [completing, setCompleting] = useState(false);
  const completingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setCompleting(false);
      completingRef.current = false;
    }
  }, [visible]);

  if (!item) return null;

  const notes = String(item.notes ?? "").trim();
  const canComplete = item.status !== "Completed";
  const photos = item.photoUris ?? [];

  async function handleDelete() {
    const ok = await confirmDestructive("Delete Task", `Remove "${item!.title}"?`);
    if (!ok) return;
    onDelete(item!.id);
    onClose();
  }

  async function handleComplete() {
    if (completingRef.current || completing) return;
    completingRef.current = true;
    setCompleting(true);
    try {
      const saved = await onComplete(item!.id);
      const next = saved && typeof saved === "object" ? saved : null;
      if (next?.recurring) {
        notifyUser(
          "Task marked complete",
          next.nextDue ? `Next due ${next.nextDue}` : item!.title
        );
      } else {
        notifyUser("Task marked complete", item!.title);
        onClose();
      }
    } catch (e) {
      notifyUser(
        "Could not complete",
        e instanceof Error ? e.message : "Please try again when you are online."
      );
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
  }

  return (
    <KeyboardModal visible={visible} onRequestClose={onClose}>
      <View style={styles.rowBetween}>
        <Text style={[styles.modalTitle, { flex: 1, marginRight: 12 }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} disabled={completing}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <DetailRow label="Category" value={item.category} />
      <DetailRow label="Status" value={item.status} />
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
        style={[styles.primaryButton, completing && { opacity: 0.6 }]}
        disabled={completing}
        onPress={() => {
          onEdit(item);
        }}
      >
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Edit</Text>
      </Pressable>

      {canComplete ? (
        <Pressable
          style={[styles.secondaryButton, { marginTop: 10 }, completing && { opacity: 0.6 }]}
          disabled={completing}
          onPress={() => {
            void handleComplete();
          }}
        >
          {completing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Mark Complete</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.secondaryButton, { marginTop: 10 }]}
        onPress={onClose}
        disabled={completing}
      >
        <Text style={styles.secondaryButtonText}>Close</Text>
      </Pressable>

      <Pressable
        style={[styles.ghostButton, { marginTop: 4 }]}
        onPress={() => {
          void handleDelete();
        }}
        disabled={completing}
      >
        <Text style={[styles.ghostButtonText, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </KeyboardModal>
  );
}

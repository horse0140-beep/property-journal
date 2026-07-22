import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DatePickerField, formatPickerDateDisplay } from "@/components/DatePickerField";
import { KeyboardModal } from "@/components/KeyboardModal";
import { RelativeDueDateField } from "@/components/RelativeDueDateField";
import { colors, styles } from "@/constants/theme";
import type { MaintenanceItem } from "@/data/demoData";
import type { CompleteMaintenanceOutcome } from "@/lib/maintenanceComplete";
import { todayIsoDate } from "@/lib/dateForDatabase";
import { takePhoto, pickImageFromLibrary } from "@/lib/fileUtils";
import { notifyUser } from "@/lib/userFeedback";
import { RepairPhotoStrip } from "@/components/RepairPhotoStrip";

export type { CompleteMaintenanceOutcome };

export type TaskCompletionPayload = {
  completedAt: string;
  completionNotes: string;
  photoUris: string[];
  outcome: CompleteMaintenanceOutcome;
  nextDue?: string;
  intervalDays?: number;
};

type Props = {
  visible: boolean;
  item: MaintenanceItem | null;
  onClose: () => void;
  onSubmit: (payload: TaskCompletionPayload) => Promise<void>;
};

const OUTCOMES: { id: CompleteMaintenanceOutcome; title: string; hint: string }[] = [
  {
    id: "delete",
    title: "Delete",
    hint: "Permanently remove this task after recording completion.",
  },
  {
    id: "reschedule",
    title: "Reschedule",
    hint: "Mark this occurrence complete and choose the next due date.",
  },
  {
    id: "archive",
    title: "Archive",
    hint: "Keep the completed task in Past Tasks and remove it from active lists.",
  },
];

function actionLabel(outcome: CompleteMaintenanceOutcome, saving: boolean): string {
  if (saving) {
    if (outcome === "delete") return "Deleting…";
    if (outcome === "reschedule") return "Rescheduling…";
    return "Archiving…";
  }
  if (outcome === "delete") return "Complete & Delete";
  if (outcome === "reschedule") return "Complete & Reschedule";
  return "Complete & Archive";
}

export function TaskCompletionModal({ visible, item, onClose, onSubmit }: Props) {
  const [completedAt, setCompletedAt] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<CompleteMaintenanceOutcome>("archive");
  const [nextDue, setNextDue] = useState("");
  const [intervalDays, setIntervalDays] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!visible || !item) return;
    setCompletedAt(todayIsoDate());
    setNotes("");
    setPhotoUris([...(item.photoUris ?? [])]);
    setOutcome(item.recurring ? "reschedule" : "archive");
    setNextDue("");
    setIntervalDays(item.intervalDays);
    setSaving(false);
    savingRef.current = false;
  }, [visible, item?.id]);

  const canSubmit = useMemo(() => {
    if (!completedAt.trim()) return false;
    if (outcome === "reschedule" && !nextDue.trim()) return false;
    return true;
  }, [completedAt, outcome, nextDue]);

  if (!item) return null;

  async function attachPhoto(fromCamera: boolean) {
    setPicking(true);
    try {
      if (fromCamera) {
        const shot = await takePhoto({ allowsEditing: false, quality: 0.85 });
        if (shot?.uri) setPhotoUris((prev) => [...prev, shot.uri]);
        return;
      }
      const results = await pickImageFromLibrary({
        allowsMultiple: true,
        allowsEditing: false,
        quality: 0.85,
      });
      if (results?.length) {
        setPhotoUris((prev) => [...prev, ...results.map((r) => r.uri)]);
      }
    } catch (e) {
      notifyUser("Photo", e instanceof Error ? e.message : "Could not add photo.");
    } finally {
      setPicking(false);
    }
  }

  async function handleSubmit() {
    if (savingRef.current || saving || !canSubmit) return;
    if (!completedAt) {
      notifyUser("Required", "Choose a completion date.");
      return;
    }
    if (outcome === "reschedule" && !nextDue) {
      notifyUser("Required", "Choose when this task is due next.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await onSubmit({
        completedAt,
        completionNotes: notes.trim(),
        photoUris,
        outcome,
        nextDue: outcome === "reschedule" ? nextDue : undefined,
        intervalDays: outcome === "reschedule" ? intervalDays : undefined,
      });
      onClose();
    } catch (e) {
      notifyUser(
        "Could not complete",
        e instanceof Error ? e.message : "Please try again when you are online."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const primaryDisabled = saving || !canSubmit;

  return (
    <KeyboardModal visible={visible} onRequestClose={() => !saving && onClose()}>
      <View style={styles.rowBetween}>
        <Text style={[styles.modalTitle, { flex: 1, marginRight: 12 }]} numberOfLines={2}>
          Complete task
        </Text>
        <Pressable onPress={onClose} disabled={saving} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={{ color: colors.textSecondary, marginBottom: 12, fontWeight: "600" }}>
        {item.title}
      </Text>

      <DatePickerField
        label="Completion date"
        value={completedAt}
        onChange={setCompletedAt}
        required
        placeholder="Select date"
      />

      <Text style={styles.label}>Completion notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="What was done?"
        placeholderTextColor={colors.textMuted}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Text style={styles.label}>Photos (optional)</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {Platform.OS !== "web" ? (
          <Pressable
            onPress={() => attachPhoto(true)}
            disabled={picking || saving}
            style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
          >
            <Text style={styles.secondaryButtonText}>Take Photo</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => attachPhoto(false)}
          disabled={picking || saving}
          style={[styles.primaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
        >
          <Text style={styles.primaryButtonText}>
            {Platform.OS === "web" ? "Choose Photos" : "Choose from Library"}
          </Text>
        </Pressable>
      </View>
      {photoUris.length > 0 ? (
        <RepairPhotoStrip
          urls={photoUris}
          onDeletePhoto={(url) => setPhotoUris((prev) => prev.filter((u) => u !== url))}
        />
      ) : null}

      <Text style={[styles.label, { marginTop: 14 }]}>What happens next?</Text>
      {OUTCOMES.map((o) => {
        const selected = outcome === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => !saving && setOutcome(o.id)}
            disabled={saving}
            style={{
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.bgSection : colors.bgCard,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View style={styles.rowBetween}>
              <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>{o.title}</Text>
              {selected ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : null}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{o.hint}</Text>
          </Pressable>
        );
      })}

      {outcome === "reschedule" ? (
        <RelativeDueDateField
          label="Next due"
          value={nextDue}
          required
          helperText="Choose a date or set when it is due next."
          onChange={(iso, meta) => {
            setNextDue(iso);
            if (meta?.intervalDays) setIntervalDays(meta.intervalDays);
          }}
        />
      ) : null}

      {outcome === "archive" ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
          Completed on {formatPickerDateDisplay(completedAt) || completedAt}. Kept in Past Tasks.
        </Text>
      ) : null}
      {outcome === "delete" ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>
          This permanently deletes the task after saving completion details.
        </Text>
      ) : null}

      <Pressable
        style={[styles.primaryButton, primaryDisabled && { opacity: 0.55 }]}
        disabled={primaryDisabled}
        onPress={() => {
          void handleSubmit();
        }}
      >
        {saving ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : null}
        <Text style={styles.primaryButtonText}>{actionLabel(outcome, saving)}</Text>
      </Pressable>

      <Pressable style={styles.ghostButton} onPress={onClose} disabled={saving}>
        <Text style={styles.ghostButtonText}>Cancel</Text>
      </Pressable>
    </KeyboardModal>
  );
}

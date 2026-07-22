import { useEffect, useRef, useState } from "react";
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
import { todayIsoDate } from "@/lib/dateForDatabase";
import { takePhoto, pickImageFromLibrary } from "@/lib/fileUtils";
import { notifyUser } from "@/lib/userFeedback";
import { RepairPhotoStrip } from "@/components/RepairPhotoStrip";

export type CompleteMaintenanceOutcome = "history" | "reschedule" | "archive";

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
    id: "history",
    title: "Move to Completed History",
    hint: "Keeps the task in Completed / Past Tasks. Does not delete it.",
  },
  {
    id: "reschedule",
    title: "Complete and schedule again",
    hint: "Sets a new due date and keeps the task active.",
  },
  {
    id: "archive",
    title: "Complete and archive",
    hint: "Marks it completed and hides it from Upcoming and Overdue.",
  },
];

export function TaskCompletionModal({ visible, item, onClose, onSubmit }: Props) {
  const [completedAt, setCompletedAt] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<CompleteMaintenanceOutcome>("history");
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
    setOutcome(item.recurring ? "reschedule" : "history");
    setNextDue("");
    setIntervalDays(item.intervalDays);
    setSaving(false);
    savingRef.current = false;
  }, [visible, item?.id]);

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
    if (savingRef.current || saving) return;
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
            onPress={() => setOutcome(o.id)}
            style={{
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.bgSection : colors.bgCard,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>{o.title}</Text>
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

      {outcome === "history" || outcome === "archive" ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
          Completed on {formatPickerDateDisplay(completedAt) || completedAt}. The task is not deleted.
        </Text>
      ) : null}

      <Pressable
        style={[styles.primaryButton, saving && { opacity: 0.6 }]}
        disabled={saving}
        onPress={() => {
          void handleSubmit();
        }}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Save completion</Text>
        )}
      </Pressable>

      <Pressable style={styles.ghostButton} onPress={onClose} disabled={saving}>
        <Text style={styles.ghostButtonText}>Cancel</Text>
      </Pressable>
    </KeyboardModal>
  );
}

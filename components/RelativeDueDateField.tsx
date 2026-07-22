import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DatePickerField, formatPickerDateDisplay } from "@/components/DatePickerField";
import { colors, styles } from "@/constants/theme";
import {
  RELATIVE_DUE_PRESETS,
  dueIsoFromRelative,
  relativeAmountToIntervalDays,
  type RelativeDueUnit,
} from "@/lib/relativeDueDate";

type Mode = "calendar" | "relative";

type RelativeDueDateFieldProps = {
  label?: string;
  value: string;
  onChange: (iso: string, meta?: { intervalDays?: number }) => void;
  required?: boolean;
  helperText?: string;
};

export function RelativeDueDateField({
  label = "Due date",
  value,
  onChange,
  required,
  helperText,
}: RelativeDueDateFieldProps) {
  const [mode, setMode] = useState<Mode>(value ? "calendar" : "relative");
  const [amountText, setAmountText] = useState("2");
  const [unit, setUnit] = useState<RelativeDueUnit>("weeks");

  const amount = Math.max(1, parseInt(amountText, 10) || 1);
  const previewIso = useMemo(() => dueIsoFromRelative(amount, unit), [amount, unit]);

  function applyRelative(nextAmount: number, nextUnit: RelativeDueUnit) {
    const iso = dueIsoFromRelative(nextAmount, nextUnit);
    onChange(iso, { intervalDays: relativeAmountToIntervalDays(nextAmount, nextUnit) });
  }

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      {helperText ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>{helperText}</Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Pressable
          onPress={() => setMode("calendar")}
          style={[styles.chip, mode === "calendar" && styles.chipActive, { flex: 1 }]}
        >
          <Text style={[{ textAlign: "center" }, mode === "calendar" ? styles.chipTextActive : styles.chipText]}>
            Choose a date
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("relative")}
          style={[styles.chip, mode === "relative" && styles.chipActive, { flex: 1 }]}
        >
          <Text style={[{ textAlign: "center" }, mode === "relative" ? styles.chipTextActive : styles.chipText]}>
            Relative timing
          </Text>
        </Pressable>
      </View>

      {mode === "calendar" ? (
        <DatePickerField
          label="Calendar date"
          value={value}
          onChange={(iso) => onChange(iso)}
          required={required}
          placeholder="Select date"
        />
      ) : (
        <>
          <Text style={[styles.label, { marginTop: 0 }]}>Quick options</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {RELATIVE_DUE_PRESETS.map((p) => {
              const iso = dueIsoFromRelative(p.amount, p.unit);
              const selected = value === iso;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setAmountText(String(p.amount));
                    setUnit(p.unit);
                    applyRelative(p.amount, p.unit);
                  }}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={selected ? styles.chipTextActive : styles.chipText}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Due in</Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              keyboardType="number-pad"
              value={amountText}
              onChangeText={setAmountText}
              placeholder="2"
              placeholderTextColor={colors.textMuted}
            />
            {(["days", "weeks", "months"] as const).map((u) => (
              <Pressable
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.chip, unit === u && styles.chipActive]}
              >
                <Text style={unit === u ? styles.chipTextActive : styles.chipText}>{u}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.secondaryButton, { marginTop: 10 }]}
            onPress={() => applyRelative(amount, unit)}
          >
            <Text style={styles.secondaryButtonText}>Use this timing</Text>
          </Pressable>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8, fontWeight: "600" }}>
            Actual due date: {formatPickerDateDisplay(previewIso)} ({previewIso})
          </Text>
        </>
      )}

      {mode === "calendar" && value ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
          Saves as {value}
        </Text>
      ) : null}
      {mode === "relative" && value ? (
        <Text style={{ color: colors.success, fontSize: 13, marginTop: 6, fontWeight: "700" }}>
          Selected: {formatPickerDateDisplay(value)} ({value})
        </Text>
      ) : null}
    </View>
  );
}

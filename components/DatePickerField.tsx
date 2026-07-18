import { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import { parseTypedDateEntry, todayIsoDate } from "@/lib/dateForDatabase";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Display ISO YYYY-MM-DD as "Month Day, Year" (e.g. June 15, 2026). */
export function formatPickerDateDisplay(iso: string | null | undefined): string {
  const raw = String(iso ?? "").trim();
  const m = ISO_DATE_RE.exec(raw);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Accept only strict ISO YYYY-MM-DD for picker state.
 * Rejects free-text like "Jun 2026", "June 2026", or "2025".
 */
export function toIsoDateValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (!ISO_DATE_RE.test(raw)) return null;
  const [, y, m, d] = ISO_DATE_RE.exec(raw)!;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const dt = new Date(year, month - 1, day);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  optional?: boolean;
  required?: boolean;
  placeholder?: string;
  /** When false, hides "Type date instead". Default true. */
  allowTypedEntry?: boolean;
};

/**
 * Native calendar date field (Expo SDK 54 / @react-native-community/datetimepicker).
 * Calendar is the default; optional typed entry accepts full dates only.
 * Always stores ISO YYYY-MM-DD.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  optional = false,
  required = false,
  placeholder = "Tap to choose a date",
  allowTypedEntry = true,
}: DatePickerFieldProps) {
  const iso = toIsoDateValue(value);
  const [open, setOpen] = useState(false);
  const [typedMode, setTypedMode] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);

  useEffect(() => {
    if (typedMode) {
      setTypedText(iso ? formatPickerDateDisplay(iso) : "");
      setTypedError(null);
    }
  }, [typedMode, iso]);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "dismissed" || !selected) return;
    }
    if (!selected) return;
    onChange(localDateToIso(selected));
  }

  function applyTypedDate() {
    const parsed = parseTypedDateEntry(typedText);
    if (!parsed.ok) {
      setTypedError(parsed.error);
      return;
    }
    if (parsed.iso === null) {
      if (required) {
        setTypedError("Enter a full date or switch back to the calendar.");
        return;
      }
      onChange("");
      setTypedError(null);
      setTypedMode(false);
      return;
    }
    onChange(parsed.iso);
    setTypedError(null);
    setTypedMode(false);
  }

  function switchToTyped() {
    setOpen(false);
    setTypedMode(true);
    setTypedError(null);
    setTypedText(iso ? formatPickerDateDisplay(iso) : "");
  }

  function switchToCalendar() {
    setTypedMode(false);
    setTypedError(null);
  }

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : optional ? " (optional)" : ""}
      </Text>

      {typedMode ? (
        <>
          <TextInput
            style={[
              styles.input,
              typedError ? { borderColor: colors.danger, borderWidth: 1.5 } : null,
            ]}
            value={typedText}
            onChangeText={(t) => {
              setTypedText(t);
              if (typedError) setTypedError(null);
            }}
            placeholder="MM/DD/YYYY or June 15, 2026"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={applyTypedDate}
            onBlur={applyTypedDate}
            accessibilityLabel={`${label} typed entry`}
          />
          {typedError ? (
            <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600", marginTop: 6 }}>
              {typedError}
            </Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
              Accepted: MM/DD/YYYY · Month Day, Year · YYYY-MM-DD
            </Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
            <Pressable onPress={applyTypedDate} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>Apply date</Text>
            </Pressable>
            <Pressable onPress={switchToCalendar} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Use calendar</Text>
            </Pressable>
            {optional ? (
              <Pressable
                onPress={() => {
                  onChange("");
                  setTypedText("");
                  setTypedError(null);
                  setTypedMode(false);
                }}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 13 }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => setOpen(true)}
            style={[
              styles.input,
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: Platform.OS === "ios" ? 14 : 12,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${label}${iso ? `: ${formatPickerDateDisplay(iso)}` : ""}`}
          >
            <Text
              style={{
                color: iso ? colors.textPrimary : colors.textMuted,
                fontSize: 15,
                fontWeight: iso ? "600" : "400",
                flex: 1,
              }}
              pointerEvents="none"
            >
              {iso ? formatPickerDateDisplay(iso) : placeholder}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </Pressable>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
            {allowTypedEntry ? (
              <Pressable onPress={switchToTyped} accessibilityRole="button">
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                  Type date instead
                </Text>
              </Pressable>
            ) : null}
            {optional && iso ? (
              <Pressable
                onPress={() => onChange("")}
                accessibilityRole="button"
                accessibilityLabel={`Clear ${label}`}
              >
                <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 13 }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {open ? (
            Platform.OS === "ios" ? (
              <View
                style={{
                  backgroundColor: colors.bgCard,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginTop: 8,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    paddingHorizontal: 12,
                    paddingTop: 8,
                  }}
                >
                  <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                    <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={iso ? isoToLocalDate(iso) : isoToLocalDate(todayIsoDate())}
                  mode="date"
                  display="spinner"
                  onChange={handleChange}
                />
              </View>
            ) : (
              <DateTimePicker
                value={iso ? isoToLocalDate(iso) : isoToLocalDate(todayIsoDate())}
                mode="date"
                display="calendar"
                onChange={handleChange}
              />
            )
          ) : null}
        </>
      )}
    </View>
  );
}

/** @deprecated Use DatePickerField — kept as alias for existing imports. */
export const DateField = DatePickerField;

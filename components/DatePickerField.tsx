import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import { todayIsoDate } from "@/lib/dateForDatabase";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Display ISO YYYY-MM-DD as "Month Day, Year" (e.g. July 15, 2026). */
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

/** Accept only strict ISO YYYY-MM-DD for picker state. */
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
};

/**
 * Native calendar date field only — no typed entry, no keyboard.
 * Stores ISO YYYY-MM-DD; displays "Month Day, Year".
 */
export function DatePickerField({
  label,
  value,
  onChange,
  optional = false,
  required = false,
  placeholder = "Select date",
}: DatePickerFieldProps) {
  const iso = toIsoDateValue(value);
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "dismissed" || !selected) return;
    }
    if (!selected) return;
    onChange(localDateToIso(selected));
  }

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : optional ? " (optional)" : ""}
      </Text>
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

      {optional && iso ? (
        <Pressable
          onPress={() => onChange("")}
          style={{ alignSelf: "flex-start", marginTop: 6, paddingVertical: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
        >
          <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 13 }}>Clear</Text>
        </Pressable>
      ) : null}

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
            display="default"
            onChange={handleChange}
          />
        )
      ) : null}
    </View>
  );
}

/** @deprecated Use DatePickerField — kept as alias for existing imports. */
export const DateField = DatePickerField;

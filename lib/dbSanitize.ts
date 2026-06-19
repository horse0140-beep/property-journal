/** Empty / whitespace-only strings → null. */
export function emptyToNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse a numeric form value; empty → null. */
export function toNumericOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/,/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse a numeric form value; empty → 0. */
export function toNumericOrZero(value: unknown): number {
  return toNumericOrNull(value) ?? 0;
}

/** Display string for values read from Supabase (number or text). */
export function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function setTextField(
  row: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (value === undefined) return;
  const text = emptyToNull(value);
  if (text === null) return;
  row[key] = text;
}

/** Empty date/text → null; undefined → omit. */
export function setDateFieldNullable(
  row: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (value === undefined) return;
  row[key] = emptyToNull(value);
}

/** Empty numeric string → null; undefined → omit. */
export function setNumericFieldNullable(
  row: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (value === undefined) return;
  row[key] = toNumericOrNull(value);
}

/** Empty numeric string → 0; undefined → omit. */
export function setNumericFieldZero(
  row: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (value === undefined) return;
  row[key] = toNumericOrZero(value);
}

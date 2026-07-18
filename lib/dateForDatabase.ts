/**
 * Shared date normalizer for Supabase `date` columns.
 *
 * The live database uses real PostgreSQL date columns for maintenance,
 * repair, and document dates, so every value sent to Supabase must be
 * ISO `YYYY-MM-DD` (or omitted). Display formatting happens only in the UI
 * via formatDateForDisplay.
 */

const PLACEHOLDER_TEXT = new Set([
  "tbd",
  "not yet",
  "not recorded",
  "not listed",
  "none",
  "—",
  "-",
  "n/a",
  "na",
]);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_LOOKUP: Record<string, number> = {};
MONTH_NAMES.forEach((name, i) => {
  const lower = name.toLowerCase();
  MONTH_LOOKUP[lower] = i + 1;
  MONTH_LOOKUP[lower.slice(0, 3)] = i + 1;
});
MONTH_LOOKUP.sept = 9;

export type NormalizedDate =
  | { ok: true; iso: string | null }
  | { ok: false; error: string };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildIso(year: number, month: number, day: number): NormalizedDate {
  if (year < 1000 || year > 9999) {
    return { ok: false, error: `Year "${year}" is out of range.` };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: `Month "${month}" is not valid.` };
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, error: `Day "${day}" is not valid for that month.` };
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return { ok: true, iso: `${year}-${mm}-${dd}` };
}

/**
 * Normalize any user-facing date input to ISO YYYY-MM-DD.
 *
 * Accepted: Date objects, YYYY-MM-DD, ISO datetimes, MM/DD/YYYY, MM/YYYY,
 * "Month YYYY", "Month D, YYYY", year-only ("2025" → 2025-01-01),
 * empty/TBD/placeholder (→ null). Anything else returns a validation error
 * so bad input never reaches Supabase.
 */
export function normalizeDateForDatabase(value: unknown): NormalizedDate {
  if (value === undefined || value === null) return { ok: true, iso: null };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { ok: false, error: "Invalid date value." };
    }
    return buildIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const raw = String(value).trim();
  if (!raw) return { ok: true, iso: null };

  const lower = raw.toLowerCase();
  if (PLACEHOLDER_TEXT.has(lower)) return { ok: true, iso: null };

  // YYYY-MM-DD (optionally with a time part)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})([t\s].*)?$/i.exec(raw);
  if (m) return buildIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // MM/DD/YYYY
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (m) return buildIso(Number(m[3]), Number(m[1]), Number(m[2]));

  // MM/YYYY → first of month
  m = /^(\d{1,2})\/(\d{4})$/.exec(raw);
  if (m) return buildIso(Number(m[2]), Number(m[1]), 1);

  // "July 2026" / "Jul 2026" → first of month
  m = /^([a-z]+)\.?\s+(\d{4})$/i.exec(raw);
  if (m) {
    const month = MONTH_LOOKUP[m[1].toLowerCase()];
    if (month) return buildIso(Number(m[2]), month, 1);
  }

  // "July 4, 2026" / "Jul 4 2026" (with optional ordinal suffix)
  m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(raw);
  if (m) {
    const month = MONTH_LOOKUP[m[1].toLowerCase()];
    if (month) return buildIso(Number(m[3]), month, Number(m[2]));
  }

  // "4 July 2026"
  m = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i.exec(raw);
  if (m) {
    const month = MONTH_LOOKUP[m[2].toLowerCase()];
    if (month) return buildIso(Number(m[3]), month, Number(m[1]));
  }

  // Year only → January 1
  m = /^(\d{4})$/.exec(raw);
  if (m) return buildIso(Number(m[1]), 1, 1);

  return {
    ok: false,
    error: `"${raw}" is not a valid date. Use a format like 07/01/2026, July 2026, 2026-07-01, or 2026.`,
  };
}

/**
 * Parse optional typed date entry for the UI date field.
 * Accepts ONLY full dates:
 *   - MM/DD/YYYY
 *   - Month Day, Year (e.g. June 15, 2026)
 *   - YYYY-MM-DD
 * Rejects partial values such as "June 2026" or "2026".
 */
export function parseTypedDateEntry(value: unknown): NormalizedDate {
  if (value === undefined || value === null) return { ok: true, iso: null };

  const raw = String(value).trim();
  if (!raw) return { ok: true, iso: null };

  // YYYY-MM-DD
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return buildIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // MM/DD/YYYY
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (m) return buildIso(Number(m[3]), Number(m[1]), Number(m[2]));

  // "June 15, 2026" / "Jun 15 2026" / "June 15th, 2026"
  m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(raw);
  if (m) {
    const month = MONTH_LOOKUP[m[1].toLowerCase()];
    if (month) return buildIso(Number(m[3]), month, Number(m[2]));
  }

  // Explicitly reject known partial formats
  if (
    /^([a-z]+)\.?\s+(\d{4})$/i.test(raw) ||
    /^(\d{4})$/.test(raw) ||
    /^(\d{1,2})\/(\d{4})$/.test(raw)
  ) {
    return {
      ok: false,
      error: "Include a full day. Use MM/DD/YYYY, Month Day, Year, or YYYY-MM-DD.",
    };
  }

  return {
    ok: false,
    error: "Use MM/DD/YYYY, Month Day, Year, or YYYY-MM-DD.",
  };
}

const STRICT_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Service-layer guard: accept ONLY strict ISO YYYY-MM-DD (or empty → null).
 * Rejects free-text like "Jun 2026", "June 2026", "2025", "06/15/2026".
 * Call this before any value is written to a PostgreSQL date column.
 */
export function assertStrictIsoDate(
  value: unknown,
  fieldLabel: string
): string | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (PLACEHOLDER_TEXT.has(lower)) return null;

  const m = STRICT_ISO_RE.exec(raw);
  if (!m) {
    throw new Error(
      `${fieldLabel}: "${raw}" is not a valid ISO date (YYYY-MM-DD). Use the calendar picker.`
    );
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const built = buildIso(year, month, day);
  if (!built.ok || !built.iso) {
    throw new Error(`${fieldLabel}: "${raw}" is not a valid calendar date.`);
  }
  return built.iso;
}

/** Normalize or throw — prefers strict ISO; does not accept free-text at the service layer. */
export function dateForDatabaseOrThrow(value: unknown, fieldLabel: string): string | null {
  return assertStrictIsoDate(value, fieldLabel);
}

/**
 * Set an ISO date on an insert/update row.
 * undefined → omit; empty/placeholder → omit (never write display text);
 * non-ISO → throw before the request reaches Supabase.
 */
export function setIsoDateFieldOmit(
  row: Record<string, unknown>,
  key: string,
  value: unknown,
  fieldLabel?: string
): void {
  if (value === undefined) return;
  const iso = assertStrictIsoDate(value, fieldLabel ?? key);
  if (iso === null) return;
  row[key] = iso;
}

/**
 * Like setIsoDateFieldOmit but writes null when empty (for nullable date columns).
 */
export function setIsoDateFieldNullable(
  row: Record<string, unknown>,
  key: string,
  value: unknown,
  fieldLabel?: string
): void {
  if (value === undefined) return;
  row[key] = assertStrictIsoDate(value, fieldLabel ?? key);
}

/** Today's date as ISO YYYY-MM-DD (device-local). */
export function todayIsoDate(): string {
  const now = new Date();
  const result = buildIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return result.ok && result.iso ? result.iso : new Date().toISOString().slice(0, 10);
}

/** Convert a timestamp to ISO YYYY-MM-DD (device-local). */
export function isoDateFromTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const result = buildIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return result.ok && result.iso ? result.iso : new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * Format a stored value for display in the UI.
 * ISO dates on the 1st of a month display as "July 2026" (month-only input
 * round-trips cleanly); other ISO dates display as "Jul 15, 2026".
 * Non-ISO legacy text is returned unchanged.
 */
export function formatDateForDisplay(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return raw;

  const monthName = MONTH_NAMES[month - 1];
  return `${monthName} ${day}, ${year}`;
}

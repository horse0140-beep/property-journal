/**
 * Relative due-date helpers. Always produce ISO YYYY-MM-DD for storage.
 */

import { isoDateFromTimestamp, todayIsoDate } from "@/lib/dateForDatabase";

export type RelativeDueUnit = "days" | "weeks" | "months";

export type RelativeDuePreset = {
  id: string;
  label: string;
  amount: number;
  unit: RelativeDueUnit;
};

export const RELATIVE_DUE_PRESETS: RelativeDuePreset[] = [
  { id: "3d", label: "3 days", amount: 3, unit: "days" },
  { id: "1w", label: "1 week", amount: 1, unit: "weeks" },
  { id: "2w", label: "2 weeks", amount: 2, unit: "weeks" },
  { id: "1m", label: "1 month", amount: 1, unit: "months" },
  { id: "2m", label: "2 months", amount: 2, unit: "months" },
  { id: "3m", label: "3 months", amount: 3, unit: "months" },
  { id: "6m", label: "6 months", amount: 6, unit: "months" },
  { id: "1y", label: "1 year", amount: 12, unit: "months" },
];

/** Approximate interval in days for recurring schedule metadata. */
export function relativeAmountToIntervalDays(amount: number, unit: RelativeDueUnit): number {
  const n = Math.max(0, Math.floor(amount));
  if (unit === "days") return n;
  if (unit === "weeks") return n * 7;
  return n * 30;
}

export function addRelativeToIso(
  baseIso: string,
  amount: number,
  unit: RelativeDueUnit
): string {
  const base = (baseIso || todayIsoDate()).slice(0, 10);
  const [y, m, d] = base.split("-").map(Number);
  if (!y || !m || !d) {
    return isoDateFromTimestamp(Date.now() + relativeAmountToIntervalDays(amount, unit) * 86400000);
  }

  const date = new Date(y, m - 1, d);
  if (unit === "days") {
    date.setDate(date.getDate() + amount);
  } else if (unit === "weeks") {
    date.setDate(date.getDate() + amount * 7);
  } else {
    date.setMonth(date.getMonth() + amount);
  }

  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function dueIsoFromRelative(amount: number, unit: RelativeDueUnit, fromIso?: string): string {
  return addRelativeToIso(fromIso ?? todayIsoDate(), amount, unit);
}

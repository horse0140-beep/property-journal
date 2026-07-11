import { Alert } from "react-native";
import { AuthRequiredError } from "@/lib/authUser";

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function formatSupabaseSaveError(error: unknown): string {
  if (error instanceof Error && error.message) {
    const extra = error as Error & SupabaseLikeError;
    const lines = [extra.message];
    if (extra.code) lines.push(`code: ${extra.code}`);
    if (extra.details) lines.push(`details: ${extra.details}`);
    if (extra.hint) lines.push(`hint: ${extra.hint}`);
    if (lines.length > 1) return lines.join("\n");
    return extra.message;
  }

  if (typeof error === "object" && error !== null) {
    const e = error as SupabaseLikeError;
    const lines: string[] = [];
    if (e.message) lines.push(e.message);
    if (e.code) lines.push(`code: ${e.code}`);
    if (e.details) lines.push(`details: ${e.details}`);
    if (e.hint) lines.push(`hint: ${e.hint}`);
    if (lines.length > 0) return lines.join("\n");
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export function attachSupabaseErrorFields(
  error: { message: string; code?: string; details?: string; hint?: string }
): Error {
  const err = new Error(error.message) as Error & SupabaseLikeError;
  err.code = error.code;
  err.details = error.details;
  err.hint = error.hint;
  return err;
}

export function logMaintenanceSaveStart(payload: unknown): number {
  console.log("[MAINTENANCE SAVE START]", { payload, at: new Date().toISOString() });
  return Date.now();
}

export function logMaintenanceSaveFailed(
  payload: unknown,
  error: unknown,
  startedAt: number,
  response?: unknown
): void {
  console.warn("[MAINTENANCE SAVE FAILED]", {
    payload,
    error: formatSupabaseSaveError(error),
    supabaseResponse: response ?? error,
    elapsedMs: Date.now() - startedAt,
  });
}

export function logRepairSaveStart(payload: unknown): number {
  console.log("[REPAIR SAVE START]", { payload, at: new Date().toISOString() });
  return Date.now();
}

export function logRepairSaveFailed(
  payload: unknown,
  error: unknown,
  startedAt: number,
  response?: unknown
): void {
  console.warn("[REPAIR SAVE FAILED]", {
    payload,
    error: formatSupabaseSaveError(error),
    supabaseResponse: response ?? error,
    elapsedMs: Date.now() - startedAt,
  });
}

function showDetailedSaveAlert(title: string, action: string, error: unknown): void {
  if (error instanceof AuthRequiredError || (error instanceof Error && error.message === "No authenticated user")) {
    Alert.alert("Session expired", "Please sign in again.");
    return;
  }

  const message = formatSupabaseSaveError(error);
  const raw = (() => {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  })();

  Alert.alert(title, `${action}\n\n${message}\n\n${raw}`);
}

export function showMaintenanceSaveError(action: string, error: unknown): void {
  showDetailedSaveAlert("Maintenance Save Failed", action, error);
}

export function showRepairSaveError(action: string, error: unknown): void {
  showDetailedSaveAlert("Repair Save Failed", action, error);
}

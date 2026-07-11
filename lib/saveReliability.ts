import { supabase } from "@/lib/supabase";

export { isInsertOkSelectFailed } from "@/lib/realSaveError";

export type SaveAction = "insert" | "update" | "delete" | "upload";

export function formatSaveError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function extractSaveErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return code != null ? String(code) : undefined;
  }
  return undefined;
}

/** Postgres unique violation — insert may have succeeded on a prior attempt. */
export function isDuplicateKeyError(error: unknown): boolean {
  const code = extractSaveErrorCode(error);
  if (code === "23505") return true;
  const msg = formatSaveError(error).toLowerCase();
  return msg.includes("duplicate key") || msg.includes("unique constraint");
}

/** One automatic retry for transient network/server errors only. */
export function isTransientSaveError(error: unknown): boolean {
  const code = extractSaveErrorCode(error);
  const msg = formatSaveError(error).toLowerCase();

  const nonRetryCodes = [
    "23505",
    "23503",
    "23502",
    "23514",
    "42501",
    "PGRST301",
    "22P02",
    "23P01",
    "PGRST116",
  ];
  if (code && nonRetryCodes.includes(code)) return false;

  if (msg.includes("row-level security")) return false;
  if (msg.includes("violates foreign key")) return false;
  if (msg.includes("violates not-null")) return false;
  if (msg.includes("not-null constraint")) return false;
  if (msg.includes("null value in column")) return false;
  if (msg.includes("duplicate key")) return false;
  if (msg.includes("invalid input")) return false;
  if (msg.includes("must be signed in")) return false;
  if (msg.includes("no authenticated user")) return false;
  if (msg.includes("is required")) return false;

  if (msg.includes("network request failed")) return true;
  if (msg.includes("failed to fetch")) return true;
  if (msg.includes("network error")) return true;
  if (msg.includes("timeout")) return true;
  if (msg.includes("timed out")) return true;
  if (msg.includes("connection")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("enotfound")) return true;
  if (msg.includes("502")) return true;
  if (msg.includes("503")) return true;
  if (msg.includes("504")) return true;
  if (msg.includes("service unavailable")) return true;
  if (msg.includes("gateway")) return true;
  if (msg.includes("failed to check profile")) return true;
  if (msg.includes("failed to bootstrap profile")) return true;

  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function logSaveStart(table: string, action: SaveAction, payload?: unknown): number {
  console.log("[SAVE START]", {
    table,
    action,
    payload,
    at: new Date().toISOString(),
  });
  return Date.now();
}

export function logSaveSuccess(
  table: string,
  action: SaveAction,
  response: unknown,
  startedAt: number,
  retried = false
): void {
  console.log("[SAVE SUCCESS]", {
    table,
    action,
    response,
    elapsedMs: Date.now() - startedAt,
    retried,
  });
}

export function logSaveFailed(
  table: string,
  action: SaveAction,
  error: unknown,
  startedAt: number,
  retried = false
): void {
  console.warn("[SAVE FAILED]", {
    table,
    action,
    error: formatSaveError(error),
    supabaseResponse: error,
    elapsedMs: Date.now() - startedAt,
    retried,
  });
}

export async function runSaveWithRetry<T>(
  table: string,
  action: SaveAction,
  payload: unknown,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = logSaveStart(table, action, payload);

  try {
    const result = await operation();
    logSaveSuccess(table, action, result, startedAt);
    return result;
  } catch (firstError) {
    if (!isTransientSaveError(firstError)) {
      logSaveFailed(table, action, firstError, startedAt);
      throw firstError;
    }

    console.warn("[SAVE RETRY]", {
      table,
      action,
      error: formatSaveError(firstError),
    });
    await delay(450);

    try {
      const result = await operation();
      logSaveSuccess(table, action, result, startedAt, true);
      return result;
    } catch (retryError) {
      logSaveFailed(table, action, retryError, startedAt, true);
      throw retryError;
    }
  }
}

/** Fetch row when insert/update succeeded but .select().single() returned 0 rows. */
export async function fetchInsertedRow(
  table: string,
  id: string,
  userId?: string
): Promise<Record<string, unknown> | null> {
  let query = supabase.from(table).select("*").eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[SAVE FETCH AFTER SELECT FAILED]", { table, id, error: error.message });
    return null;
  }
  return data as Record<string, unknown> | null;
}

/** Recover after PGRST116 or duplicate-key when the row likely exists. */
export async function recoverRowAfterLikelyInsert(
  table: string,
  id: string,
  userId: string | undefined,
  reason: string
): Promise<Record<string, unknown> | null> {
  console.warn("[SAVE INSERT RECOVER FETCH]", { table, id, reason });
  return fetchInsertedRow(table, id, userId);
}

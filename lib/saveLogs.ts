import { formatSaveError } from "@/lib/saveReliability";

export function logSaveSuccess(type: string, data: unknown) {
  console.log("[SAVE SUCCESS]", { table: type, action: "write", response: data });
}

export function logSaveErrorFull(type: string, error: unknown) {
  console.warn("[SAVE FAILED]", {
    table: type,
    action: "write",
    error: formatSaveError(error),
    supabaseResponse: error,
  });
}

export function throwIfSaveError(type: string, error: { message: string } | null): void {
  if (!error) return;
  logSaveErrorFull(type, error);
  throw new Error(error.message);
}

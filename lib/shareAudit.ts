/**
 * Development/audit logging for property share flow.
 * Never logs Supabase keys or full PII. Tokens are masked in reports.
 */

export function maskToken(token: string | null | undefined): string {
  const t = (token ?? "").trim();
  if (!t) return "(empty)";
  if (t.length <= 6) return `${t[0] ?? ""}***`;
  return `${t.slice(0, 4)}…${t.slice(-3)} (len=${t.length})`;
}

export type ShareAuditFields = Record<string, string | number | boolean | null | undefined>;

/** Always-on numbered audit steps for share debugging (safe fields only). */
export function shareAudit(step: string, fields?: ShareAuditFields): void {
  const safe: ShareAuditFields = {};
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (k.toLowerCase().includes("key") || k.toLowerCase().includes("secret")) continue;
      if (k === "token" && typeof v === "string") {
        safe.token = maskToken(v);
        safe.tokenLength = v.trim().length;
        continue;
      }
      safe[k] = v;
    }
  }
  console.info(`[SHARE AUDIT ${step}]`, safe);
}

export function shareAuditFailure(
  step: string,
  err: unknown,
  extra?: ShareAuditFields
): void {
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    statusCode?: number;
  } | null;
  shareAudit(`FAIL @ ${step}`, {
    errorMessage: e?.message ?? (err instanceof Error ? err.message : String(err)),
    errorCode: e?.code ?? null,
    errorDetails: e?.details ?? null,
    errorHint: e?.hint ?? null,
    httpStatus: e?.status ?? e?.statusCode ?? null,
    ...extra,
  });
}

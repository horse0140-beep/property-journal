/**
 * Development/audit logging for property share flow.
 * Never logs Supabase keys or full PII. Tokens are masked in reports.
 * Silent in production unless EXPO_PUBLIC_DEBUG_SHARE=1.
 */

function isShareAuditEnabled(): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) return true;
  const v = process.env.EXPO_PUBLIC_DEBUG_SHARE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function maskToken(token: string | null | undefined): string {
  const t = (token ?? "").trim();
  if (!t) return "(empty)";
  // Last 4 characters only — never log the full share token.
  if (t.length <= 4) return `…${t}`;
  return `…${t.slice(-4)} (len=${t.length})`;
}

export type ShareAuditFields = Record<string, string | number | boolean | null | undefined>;

/** Numbered audit steps for share debugging (safe fields only). Gated. */
export function shareAudit(step: string, fields?: ShareAuditFields): void {
  if (!isShareAuditEnabled()) return;
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
  if (!isShareAuditEnabled()) return;
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

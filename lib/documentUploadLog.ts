/**
 * Temporary document-upload audit logs for Property Journal preview builds.
 * Tags: [DOC AUDIT NN]
 */

import { Alert } from "react-native";

export type DocAuditStep =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18;

export const DOC_AUDIT_LABEL: Record<DocAuditStep, string> = {
  1: "Save pressed",
  2: "Picker result",
  3: "Local URI",
  4: "File exists",
  5: "File size",
  6: "MIME type",
  7: "Bucket name",
  8: "Storage path",
  9: "Upload body created",
  10: "Upload started",
  11: "Upload response",
  12: "Stored object verification",
  13: "Database payload",
  14: "Database response",
  15: "Row recovery",
  16: "Local state update",
  17: "Refresh result",
  18: "Success",
};

export type DocAuditContext = {
  localUri?: string;
  fileName?: string;
  extension?: string;
  mimeType?: string;
  fileSize?: number | string;
  bucket?: string;
  storagePath?: string;
  table?: string;
  insertPayload?: unknown;
  elapsedMs?: number;
};

function pad(step: DocAuditStep): string {
  return String(step).padStart(2, "0");
}

/** Never log full device paths or secrets in alerts. */
export function redactUri(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  const u = uri.trim();
  if (u.startsWith("content://")) return "content://…";
  if (u.startsWith("file://")) return "file://…";
  if (u.startsWith("http://") || u.startsWith("https://")) {
    try {
      const parsed = new URL(u);
      return `${parsed.origin}/…`;
    } catch {
      return "https://…";
    }
  }
  return "(local-uri)";
}

export function extractErrorFields(error: unknown): {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
} {
  if (error instanceof DocumentAuditError) {
    return {
      code: error.code,
      message: error.rawMessage,
      details: error.details,
      hint: error.hint,
    };
  }
  if (error instanceof Error) {
    const anyErr = error as Error & { code?: string; details?: string; hint?: string };
    return {
      code: anyErr.code,
      message: error.message,
      details: anyErr.details,
      hint: anyErr.hint,
    };
  }
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      code: e.code != null ? String(e.code) : undefined,
      message: typeof e.message === "string" ? e.message : JSON.stringify(error),
      details: e.details != null ? String(e.details) : undefined,
      hint: e.hint != null ? String(e.hint) : undefined,
    };
  }
  return { message: String(error) };
}

export function logDocAudit(step: DocAuditStep, data?: unknown) {
  console.log(`[DOC AUDIT ${pad(step)}] ${DOC_AUDIT_LABEL[step]}`, data ?? "");
}

export function logDocAuditFail(step: DocAuditStep, error: unknown, ctx: DocAuditContext = {}) {
  const fields = extractErrorFields(error);
  console.warn(`[DOC AUDIT FAIL ${pad(step)}] ${DOC_AUDIT_LABEL[step]}`, {
    step,
    errorCode: fields.code,
    errorMessage: fields.message,
    errorDetails: fields.details,
    errorHint: fields.hint,
    localUri: redactUri(ctx.localUri),
    fileName: ctx.fileName,
    extension: ctx.extension,
    mimeType: ctx.mimeType,
    fileSize: ctx.fileSize,
    bucket: ctx.bucket,
    storagePath: ctx.storagePath,
    table: ctx.table,
    insertPayload: ctx.insertPayload,
    elapsedMs: ctx.elapsedMs,
  });
}

export class DocumentAuditError extends Error {
  readonly step: DocAuditStep;
  readonly stepLabel: string;
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;
  readonly rawMessage: string;

  constructor(step: DocAuditStep, error: unknown, ctx: DocAuditContext = {}) {
    const fields = extractErrorFields(error);
    const stepLabel = DOC_AUDIT_LABEL[step];
    const codePart = fields.code ? `${fields.code}: ` : "";
    super(`Step ${step} — ${stepLabel}\n${codePart}${fields.message}`);
    this.name = "DocumentAuditError";
    this.step = step;
    this.stepLabel = stepLabel;
    this.code = fields.code;
    this.details = fields.details;
    this.hint = fields.hint;
    this.rawMessage = fields.message;
    logDocAuditFail(step, error, ctx);
  }
}

export function docAuditFail(step: DocAuditStep, error: unknown, ctx: DocAuditContext = {}): DocumentAuditError {
  return new DocumentAuditError(step, error, ctx);
}

/** Always show real document-upload diagnostics (preview audit). */
export function showDocumentAuditError(error: unknown) {
  if (error instanceof DocumentAuditError) {
    const lines = [
      `Step ${error.step} — ${error.stepLabel}`,
      error.code ? `${error.code}: ${error.rawMessage}` : error.rawMessage,
    ];
    if (error.details) lines.push(`details: ${error.details}`);
    if (error.hint) lines.push(`hint: ${error.hint}`);
    Alert.alert("Document Upload Failed", lines.join("\n"));
    return;
  }

  const fields = extractErrorFields(error);
  const body = fields.code ? `${fields.code}: ${fields.message}` : fields.message;
  Alert.alert("Document Upload Failed", body);
}

export function extensionFromNameOrUri(nameOrUri?: string): string | undefined {
  if (!nameOrUri) return undefined;
  const clean = nameOrUri.split("?")[0];
  const match = clean.match(/\.([a-zA-Z0-9]{1,5})$/);
  return match?.[1]?.toLowerCase();
}

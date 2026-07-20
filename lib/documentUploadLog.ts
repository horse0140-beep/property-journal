/** Numbered diagnostic logs for the Property Journal / vault document upload pipeline. */

export type DocumentStep =
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
  | 14;

const STEP_LABEL: Record<DocumentStep, string> = {
  1: "picker result",
  2: "local URI",
  3: "file info / existence / size / MIME type",
  4: "bucket selected",
  5: "storage path",
  6: "upload request",
  7: "raw Supabase upload response",
  8: "public or signed URL creation",
  9: "URL verification",
  10: "database insert payload",
  11: "database insert response",
  12: "inserted row verification",
  13: "refresh result",
  14: "viewer URL resolution",
};

export function logDocumentStep(step: DocumentStep, data?: unknown) {
  console.log(`[DOCUMENT STEP ${step}] ${STEP_LABEL[step]}`, data ?? "");
}

export function extractSupabaseErrorFields(error: unknown): {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : String(error) };
  }
  const e = error as Record<string, unknown>;
  return {
    code: e.code != null ? String(e.code) : undefined,
    message:
      typeof e.message === "string"
        ? e.message
        : error instanceof Error
          ? error.message
          : undefined,
    details: e.details != null ? String(e.details) : undefined,
    hint: e.hint != null ? String(e.hint) : undefined,
  };
}

export function logDocumentFailure(
  step: DocumentStep,
  error: unknown,
  ctx: {
    bucket?: string;
    path?: string;
    mimeType?: string;
    fileSize?: number | string;
    localUri?: string;
    dbPayload?: unknown;
  } = {}
) {
  const fields = extractSupabaseErrorFields(error);
  console.warn(`[DOCUMENT FAIL STEP ${step}] ${STEP_LABEL[step]}`, {
    step,
    errorCode: fields.code,
    errorMessage: fields.message,
    errorDetails: fields.details,
    errorHint: fields.hint,
    bucket: ctx.bucket,
    path: ctx.path,
    mimeType: ctx.mimeType,
    fileSize: ctx.fileSize,
    localUri: ctx.localUri,
    dbPayload: ctx.dbPayload,
    rawError: error,
  });
}

/** Build an Error that preserves Supabase code/details/hint in the message for Alert. */
export function documentPipelineError(
  step: DocumentStep,
  error: unknown,
  ctx: {
    bucket?: string;
    path?: string;
    mimeType?: string;
    fileSize?: number | string;
    localUri?: string;
    dbPayload?: unknown;
  } = {}
): Error {
  logDocumentFailure(step, error, ctx);
  const fields = extractSupabaseErrorFields(error);
  const parts = [
    `STEP ${step} failed: ${fields.message ?? "unknown error"}`,
    fields.code ? `code=${fields.code}` : null,
    fields.details ? `details=${fields.details}` : null,
    fields.hint ? `hint=${fields.hint}` : null,
    ctx.bucket ? `bucket=${ctx.bucket}` : null,
    ctx.path ? `path=${ctx.path}` : null,
    ctx.mimeType ? `mime=${ctx.mimeType}` : null,
    ctx.fileSize != null ? `size=${ctx.fileSize}` : null,
  ].filter(Boolean);
  return new Error(parts.join(" | "));
}

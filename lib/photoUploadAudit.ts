/** Structured audit logging for the 12-step photo upload pipeline. */

const UPLOAD_FAILED = "Photo upload failed before save.";

export const PIPELINE_STEPS = {
  1: "ImagePicker result",
  2: "localUri",
  3: "file exists",
  4: "upload() request",
  5: "Supabase upload response",
  6: "storage path returned",
  7: "getPublicUrl() or createSignedUrl()",
  8: "verify URL returns HTTP 200",
  9: "database insert payload",
  10: "database row after insert",
  11: "fetchPhotos()",
  12: "PhotoCard render",
} as const;

export type PipelineStep = keyof typeof PIPELINE_STEPS;

export function auditPipelineStep(step: PipelineStep, value?: unknown): void {
  const label = PIPELINE_STEPS[step];
  if (value !== undefined) {
    console.log(`[UPLOAD STEP ${step}] ${label}:`, value);
  } else {
    console.log(`[UPLOAD STEP ${step}] ${label}`);
  }
}

/** @deprecated Use auditPipelineStep */
export function auditStep(step: number, label: string, value?: unknown): void {
  if (value !== undefined) {
    console.log(`[UPLOAD STEP ${step}] ${label}:`, value);
  } else {
    console.log(`[UPLOAD STEP ${step}] ${label}`);
  }
}

export function auditUpload(key: string, value: unknown): void {
  console.log(`[UPLOAD] ${key}:`, value);
}

export function auditBucketUsed(bucket: string, source: string): void {
  console.log(`[UPLOAD] BUCKET USED FOR UPLOAD: ${bucket} (via ${source})`);
}

export function auditDbInsert(payload: unknown): void {
  console.log("[DB INSERT]", payload);
}

export function auditDbRow(row: unknown): void {
  console.log("[DB ROW]", row);
}

export function auditFetchedRow(row: unknown): void {
  console.log("[FETCHED ROW]", row);
}

export function auditPhotoCardUri(uri: unknown): void {
  console.log("[PHOTOCARD URI]", uri);
}

export function auditImageFetch(result: unknown): void {
  console.log("[IMAGE FETCH]", result);
}

export function auditStop(step: PipelineStep | number | string, reason: string, detail?: unknown): never {
  const stepLabel =
    typeof step === "number" && step in PIPELINE_STEPS
      ? `${step} (${PIPELINE_STEPS[step as PipelineStep]})`
      : String(step);
  console.error(`[UPLOAD] STOP at STEP ${stepLabel} — ${reason}`, detail ?? "");
  throw new Error(`${UPLOAD_FAILED} (step ${stepLabel}: ${reason})`);
}

export function assertAuditValue(
  step: PipelineStep | number | string,
  label: string,
  value: unknown,
  requireHttps = false
): string {
  if (value == null || value === "") {
    auditStop(step, `${label} is null/undefined/empty`);
  }

  const text = String(value).trim();
  if (!text) {
    auditStop(step, `${label} is empty after trim`);
  }

  if (requireHttps && !text.startsWith("https://")) {
    auditStop(step, `${label} is not https://`, text);
  }

  return text;
}

export function dbUrlFields(row: Record<string, unknown> | null | undefined) {
  if (!row) return row;
  return {
    id: row.id,
    file_url: row.file_url,
    photo_url: row.photo_url,
    uri: row.uri,
    storage_path: row.storage_path,
    storage_bucket: row.storage_bucket,
    category: row.category,
  };
}

const VALID_PHOTO_BUCKETS = new Set([
  "property-photos",
  "repair-photos",
  "before-after-photos",
]);

const FORBIDDEN_BUCKETS = new Set(["photos", "property_photos"]);

export function assertValidPhotoBucket(
  step: PipelineStep,
  bucket: string,
  photoType: string
): void {
  auditBucketUsed(bucket, `getPhotoBucket(${JSON.stringify(photoType)})`);

  if (FORBIDDEN_BUCKETS.has(bucket)) {
    auditStop(step, `legacy/forbidden bucket "${bucket}" — must use property-photos`, {
      bucket,
      photoType,
      expected: "property-photos",
    });
  }

  if (!VALID_PHOTO_BUCKETS.has(bucket)) {
    auditStop(step, `unexpected bucket "${bucket}" for photo upload`, { bucket, photoType });
  }

  if (photoType === "property" && bucket !== "property-photos") {
    auditStop(step, `property photo must use property-photos but got "${bucket}"`, {
      bucket,
      photoType,
    });
  }
}

export { UPLOAD_FAILED as UPLOAD_FAILED_MESSAGE };

/** Supabase Storage bucket names that exist in production. */
export type StorageBucket =
  | "property-photos"
  | "repair-photos"
  | "before-after-photos"
  | "receipts"
  | "warranties"
  | "documents"
  | "reports"
  | "leases"
  | "inspection-files"
  | "avatars";

export type PhotoStorageKind = "property" | "repair" | "before_after";

const BEFORE_AFTER_ALIASES = new Set([
  "before_after",
  "before-after",
  "beforeafter",
  "before",
  "after",
]);

const REPAIR_ALIASES = new Set(["repair", "maintenance", "maintenance_repair", "maintenance-repair"]);

function normalizePhotoKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/]+/g, "_");
}

/**
 * Resolve the Supabase Storage bucket for a property photo upload.
 * There is NO bucket named "photos" — always use one of the buckets below.
 */
export function getPhotoBucket(photoTypeOrCategory: PhotoStorageKind | string): StorageBucket {
  const key = normalizePhotoKey(String(photoTypeOrCategory ?? "property"));
  let bucket: StorageBucket;

  if (REPAIR_ALIASES.has(key)) {
    bucket = "repair-photos";
  } else if (BEFORE_AFTER_ALIASES.has(key)) {
    bucket = "before-after-photos";
  } else {
    bucket = "property-photos";
  }

  console.log("[UPLOAD] getPhotoBucket:", { input: photoTypeOrCategory, normalized: key, bucket });
  return bucket;
}

/** Map UI photo category labels to storage kind. */
export function photoKindFromCategory(category: string | undefined): PhotoStorageKind {
  const key = normalizePhotoKey(category ?? "");
  if (BEFORE_AFTER_ALIASES.has(key)) return "before_after";
  if (REPAIR_ALIASES.has(key)) return "repair";
  return "property";
}

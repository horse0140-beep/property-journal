import type { PhotoItem } from "@/data/demoData";
import { getPhotoBucket, photoKindFromCategory } from "@/services/storageBuckets";
import type { StorageBucket } from "@/services/storageBuckets";
import { getAccessibleUrl, isRemoteUri } from "@/services/storageService";

type PhotoUrlSource = PhotoItem | Record<string, unknown>;

const URL_CANDIDATE_KEYS = [
  "uri",
  "photo_url",
  "file_url",
  "url",
  "image_url",
  "storage_path",
] as const;

const PHOTO_BUCKETS: StorageBucket[] = [
  "property-photos",
  "repair-photos",
  "before-after-photos",
  "avatars",
];

/** Resolve the first raw URL/path string from any photo row shape. */
export function resolvePhotoImageUrl(photo: PhotoUrlSource | null | undefined): string {
  if (!photo) return "";

  const record = photo as Record<string, unknown>;
  for (const key of URL_CANDIDATE_KEYS) {
    const url = String(record[key] ?? "").trim();
    if (url) return url;
  }

  return "";
}

export function hasDisplayablePhotoUrl(url: string | null | undefined): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("content:")
  );
}

function photoCategory(photo: PhotoUrlSource): string {
  const record = photo as Record<string, unknown>;
  return String(record.category ?? "");
}

function bucketForPhoto(photo: PhotoUrlSource): StorageBucket {
  const record = photo as Record<string, unknown>;
  const explicit = String(record.storage_bucket ?? record.bucket ?? "").trim();
  if (explicit && PHOTO_BUCKETS.includes(explicit as StorageBucket)) {
    return explicit as StorageBucket;
  }
  return getPhotoBucket(photoKindFromCategory(photoCategory(photo)));
}

function parseBucketAndPath(value: string): { bucket: StorageBucket; path: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  for (const bucket of PHOTO_BUCKETS) {
    const publicMarker = `/object/public/${bucket}/`;
    const publicIdx = trimmed.indexOf(publicMarker);
    if (publicIdx !== -1) {
      return {
        bucket,
        path: decodeURIComponent(trimmed.slice(publicIdx + publicMarker.length).split("?")[0]),
      };
    }

    const signedMarker = `/object/sign/${bucket}/`;
    const signedIdx = trimmed.indexOf(signedMarker);
    if (signedIdx !== -1) {
      return {
        bucket,
        path: decodeURIComponent(trimmed.slice(signedIdx + signedMarker.length).split("?")[0]),
      };
    }

    if (trimmed.startsWith(`${bucket}/`)) {
      return { bucket, path: trimmed.slice(bucket.length + 1) };
    }
  }

  return null;
}

function isBareStoragePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isRemoteUri(trimmed)) return false;
  if (trimmed.startsWith("file:") || trimmed.startsWith("content:")) return false;
  return trimmed.includes("/");
}

/** Convert a raw photo reference into a URL suitable for <Image source={{ uri }}>. */
export async function resolvePhotoDisplayUrl(photo: PhotoUrlSource | null | undefined): Promise<string> {
  const raw = resolvePhotoImageUrl(photo);
  if (!raw) return "";

  if (hasDisplayablePhotoUrl(raw)) {
    if (isRemoteUri(raw)) return raw;
    if (raw.startsWith("file:") || raw.startsWith("content:")) return raw;
  }

  const parsed = parseBucketAndPath(raw);
  const bucket = parsed?.bucket ?? bucketForPhoto(photo!);
  const path = parsed?.path ?? (isBareStoragePath(raw) ? raw : "");

  if (!path) {
    return isRemoteUri(raw) ? raw : "";
  }

  try {
    const accessible = await getAccessibleUrl(bucket, path);
    return accessible.trim();
  } catch (error) {
    console.warn("[photoUtils] resolvePhotoDisplayUrl failed:", error);
    return isRemoteUri(raw) ? raw : "";
  }
}

/** Normalize any photo row into a PhotoItem with uri set for display (sync). */
export function normalizePhotoItem(photo: PhotoUrlSource): PhotoItem {
  const record = photo as Record<string, unknown>;
  const uri = resolvePhotoImageUrl(photo);

  return {
    id: String(record.id ?? ""),
    propertyId: String(record.propertyId ?? record.property_id ?? ""),
    uri,
    caption: String(record.caption ?? ""),
    date: String(record.date ?? ""),
    category: String(record.category ?? "general"),
  };
}

/** Normalize a photo row and resolve storage paths to accessible URLs. */
export async function normalizePhotoItemAsync(photo: PhotoUrlSource): Promise<PhotoItem> {
  const base = normalizePhotoItem(photo);
  const displayUrl = await resolvePhotoDisplayUrl(photo);
  return {
    ...base,
    uri: displayUrl || base.uri,
  };
}

export async function normalizePhotoItemsAsync(photos: PhotoUrlSource[]): Promise<PhotoItem[]> {
  return Promise.all(photos.map((photo) => normalizePhotoItemAsync(photo)));
}

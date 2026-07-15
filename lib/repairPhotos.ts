import {
  deleteFromStorage,
  getAccessibleUrl,
  storagePathFromUrl,
} from "@/services/storageService";

const REPAIR_PHOTO_BUCKET = "repair-photos";

/**
 * Resolve a stored repair photo URL for display.
 * repair-photos is a private bucket, so rows hold signed URLs that expire.
 * When the storage path can be recovered from the URL, a fresh signed URL is
 * created so thumbnails keep working after app restarts and re-logins.
 */
export async function resolveRepairPhotoUrl(storedUrl: string): Promise<string> {
  const url = (storedUrl ?? "").trim();
  if (!url) return "";

  const path = storagePathFromUrl(REPAIR_PHOTO_BUCKET, url);
  if (path) {
    try {
      const fresh = await getAccessibleUrl(REPAIR_PHOTO_BUCKET, path);
      console.log("[REPAIR PHOTO RESOLVED URL]", { path, resolved: fresh });
      return fresh;
    } catch (e) {
      console.warn("[REPAIR PHOTO RESOLVED URL] re-sign failed — using stored URL:", e);
      return url;
    }
  }

  console.log("[REPAIR PHOTO RESOLVED URL]", { resolved: url, note: "no repair-photos path in URL" });
  return url;
}

/** Remove the storage object behind a stored repair photo URL (best-effort). */
export async function deleteRepairPhotoObject(storedUrl: string): Promise<void> {
  await deleteFromStorage(REPAIR_PHOTO_BUCKET, storedUrl);
}

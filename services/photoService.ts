import { supabase } from "@/lib/supabase";
import { logAuthUserIdAudit } from "@/lib/authUser";
import { logSaveErrorFull } from "@/lib/saveLogs";
import { isInsertOkSelectFailed } from "@/lib/realSaveError";
import { runSaveWithRetry } from "@/lib/saveReliability";
import { omitMissingOptionalColumn, PHOTO_OPTIONAL_COLUMNS } from "@/lib/dbErrors";
import {
  assertAuditValue,
  assertValidPhotoBucket,
  auditDbInsert,
  auditDbRow,
  auditFetchedRow,
  auditImageFetch,
  auditPhotoCardUri,
  auditPipelineStep,
  auditStop,
  auditUpload,
  dbUrlFields,
} from "@/lib/photoUploadAudit";
import { getPhotoBucket, photoKindFromCategory, type PhotoStorageKind } from "@/services/storageBuckets";
import type { StorageBucket } from "@/services/storageBuckets";
import {
  deleteStorageObject,
  isRemoteUri,
  storagePathFromUrl,
  uploadLocalFile,
  verifyImageUrlHttp200,
  verifyStorageBucketExists,
  verifyStorageObjectExists,
} from "@/services/storageService";
import { normalizePhotoItemAsync, normalizePhotoItemsAsync, resolvePhotoDisplayUrl } from "@/lib/photoUtils";

export type PhotoRecord = {
  id: string;
  propertyId: string;
  uri: string;
  caption: string;
  date: string;
  category: string;
};

export type SavePhotoInput = {
  id: string;
  propertyId: string;
  uri: string;
  caption?: string;
  date?: string;
  category?: string;
  photoType?: PhotoStorageKind | string;
};

type PhotoUploadResult = {
  bucket: StorageBucket;
  storagePath: string;
  publicUrl: string;
  urlMethod?: "getPublicUrl" | "createSignedUrl";
};

const URL_FIELD_KEYS = ["uri", "photo_url", "file_url", "storage_path"] as const;

// Orphan repair is a data-cleanup job, not a read dependency — run it at most
// once per app session instead of on every fetch.
let orphanRepairDone = false;

async function resolveAuthUserId(): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be signed in to save photos.");
  }

  return user.id;
}

async function assertPropertyOwnedByUser(propertyId: string, authUserId: string): Promise<void> {
  const { data: ownedProperty, error: propertyError } = await supabase
    .from("properties")
    .select("id, user_id")
    .eq("id", propertyId)
    .eq("user_id", authUserId)
    .maybeSingle();

  if (propertyError) throw new Error(propertyError.message);
  if (!ownedProperty) {
    throw new Error("Property not found or you do not have access.");
  }
}

export function isUsablePhotoUrl(url: string | null | undefined): boolean {
  const trimmed = (url ?? "").trim();
  return trimmed.startsWith("https://");
}

function rowHasAnyUrlField(row: Record<string, unknown>): boolean {
  for (const key of URL_FIELD_KEYS) {
    const value = String(row[key] ?? "").trim();
    if (value) return true;
  }
  return false;
}

function assertRowUrlFields(step: 10, row: Record<string, unknown>): void {
  for (const key of ["file_url", "photo_url", "uri", "storage_path"] as const) {
    const value = row[key];
    if (value == null || String(value).trim() === "") {
      auditStop(step, `DB row missing ${key}`, dbUrlFields(row));
    }
  }
  for (const key of ["file_url", "photo_url", "uri"] as const) {
    assertAuditValue(step, key, row[key], true);
  }
}

async function rollbackInsertedPhoto(
  photoId: string,
  authUserId: string,
  upload: PhotoUploadResult
): Promise<void> {
  await supabase.from("photos").delete().eq("id", photoId).eq("user_id", authUserId);
  if (upload.storagePath) {
    await deleteStorageObject(upload.bucket, upload.storagePath);
  }
  console.log("[UPLOAD] rolled back unusable photo row + storage object", { photoId });
}

/** Delete photo rows that have no URL/path data at all. */
export async function repairOrphanedPhotos(deleteOrphans = true): Promise<number> {
  const authUserId = await resolveAuthUserId();

  const { data, error } = await supabase
    .from("photos")
    .select("id, uri, photo_url, file_url, storage_path, category")
    .eq("user_id", authUserId);

  if (error) throw new Error(error.message);

  const orphans = (data ?? []).filter((row) => !rowHasAnyUrlField(row as Record<string, unknown>));

  if (orphans.length > 0) {
    console.log(
      "[UPLOAD] orphan photo rows (no URL fields):",
      orphans.map((r) => dbUrlFields(r as Record<string, unknown>))
    );
  }

  const orphanIds = orphans.map((row) => row.id as string);

  if (!deleteOrphans || orphanIds.length === 0) {
    return orphanIds.length;
  }

  const { error: deleteError } = await supabase.from("photos").delete().in("id", orphanIds);
  if (deleteError) throw new Error(deleteError.message);

  console.log("[UPLOAD] deleted orphan rows:", orphanIds.length);
  return orphanIds.length;
}

export async function fetchPhotos(): Promise<PhotoRecord[]> {
  const authUserId = await resolveAuthUserId();

  if (!orphanRepairDone) {
    orphanRepairDone = true;
    await repairOrphanedPhotos(true).catch((e) => {
      console.warn("[UPLOAD] orphan repair skipped:", e);
    });
  }

  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  auditPipelineStep(11, { count: (data ?? []).length });

  const normalized = await normalizePhotoItemsAsync((data ?? []) as Record<string, unknown>[]);

  for (const photo of normalized) {
    auditPhotoCardUri(photo.uri);
  }

  return normalized;
}

async function verifyUrlHttp200Step8(
  url: string,
  upload: PhotoUploadResult
): Promise<void> {
  auditPipelineStep(8, url);

  const headCheck = await verifyImageUrlHttp200(url);
  auditImageFetch({ step: 8, url, ...headCheck });
  auditUpload("headCheck", headCheck);

  if (!headCheck.ok) {
    if (upload.storagePath) {
      await deleteStorageObject(upload.bucket, upload.storagePath);
    }
    auditStop(8, "URL did not return HTTP 200 — storage object removed, no DB row saved", {
      url,
      bucket: upload.bucket,
      storagePath: upload.storagePath,
      ...headCheck,
    });
  }
}

async function uploadPhotoToBucket(
  authUserId: string,
  localOrRemoteUri: string,
  photoTypeOrCategory: PhotoStorageKind | string
): Promise<PhotoUploadResult> {
  const photoType = String(photoTypeOrCategory ?? "property");

  // STEP 2
  const localUri = assertAuditValue(2, "localUri", localOrRemoteUri.trim());
  auditPipelineStep(2, localUri);
  auditUpload("localUri", localUri);

  const bucket = getPhotoBucket(photoTypeOrCategory);
  assertValidPhotoBucket(2, bucket, photoType);

  const bucketCheck = await verifyStorageBucketExists(bucket);
  auditUpload("bucketExists", bucketCheck);
  if (!bucketCheck.ok) {
    auditStop(2, `bucket "${bucket}" not reachable`, bucketCheck.error);
  }

  if (isRemoteUri(localUri)) {
    const remoteUrl = assertAuditValue(7, "publicUrl", localUri, true);
    auditPipelineStep(5, "(skipped — already remote URL)");
    auditPipelineStep(6, "(remote)");
    auditPipelineStep(7, { urlMethod: "remote", url: remoteUrl });
    const upload: PhotoUploadResult = { bucket, storagePath: "", publicUrl: remoteUrl };
    await verifyUrlHttp200Step8(remoteUrl, upload);
    return upload;
  }

  const uploaded = await uploadLocalFile(authUserId, bucket, localUri);

  if (!uploaded.uploadResponse && !uploaded.path) {
    auditStop(5, "storage upload returned no data", uploaded);
  }

  const storagePath = assertAuditValue(6, "storagePath", uploaded.path);
  const publicUrl = assertAuditValue(7, "publicUrl", uploaded.url, true);

  const storageCheck = await verifyStorageObjectExists(bucket, storagePath);
  auditUpload("storageObjectExists", storageCheck);
  if (!storageCheck.exists) {
    await deleteStorageObject(bucket, storagePath);
    auditStop(6, "uploaded object not found in storage — object removed", {
      bucket,
      storagePath,
      error: storageCheck.error,
    });
  }

  const upload: PhotoUploadResult = {
    bucket,
    storagePath,
    publicUrl,
    urlMethod: uploaded.urlMethod,
  };

  await verifyUrlHttp200Step8(publicUrl, upload);

  return upload;
}

function buildPhotoInsertPayload(
  authUserId: string,
  photo: {
    id: string;
    propertyId: string;
    caption: string;
    date: string;
    category: string;
  },
  upload: PhotoUploadResult
): Record<string, unknown> {
  const publicUrl = assertAuditValue(9, "payload publicUrl", upload.publicUrl, true);
  const storagePath = assertAuditValue(9, "payload storagePath", upload.storagePath || "(remote)");

  return {
    id: photo.id,
    user_id: authUserId,
    property_id: photo.propertyId,
    file_url: publicUrl,
    photo_url: publicUrl,
    uri: publicUrl,
    storage_path: upload.storagePath || storagePath,
    storage_bucket: upload.bucket,
    caption: photo.caption ?? "",
    date: photo.date || null,
    category: photo.category ?? "general",
  };
}

async function selectPhotoRow(photoId: string, authUserId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("id", photoId)
    .eq("user_id", authUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    auditStop(10, "SELECT returned no row", { photoId });
  }

  return data as Record<string, unknown>;
}

async function insertPhotoRow(
  authUserId: string,
  photo: {
    id: string;
    propertyId: string;
    caption: string;
    date: string;
    category: string;
  },
  upload: PhotoUploadResult
): Promise<Record<string, unknown>> {
  let payload = buildPhotoInsertPayload(authUserId, photo, upload);

  // STEP 9
  auditPipelineStep(9);
  auditDbInsert(payload);

  logAuthUserIdAudit("createPhotoRecord", authUserId, String(payload.user_id));

  for (;;) {
    const { data, error } = await supabase.from("photos").insert(payload).select().single();

    if (!error && data) {
      const row = data as Record<string, unknown>;
      auditPipelineStep(10, dbUrlFields(row));
      auditDbRow(dbUrlFields(row));
      assertRowUrlFields(10, row);
      return row;
    }

    if (error && isInsertOkSelectFailed(error)) {
      console.warn("[UPLOAD] INSERT ok but .single() SELECT failed — fetching row directly");
      const row = await selectPhotoRow(photo.id, authUserId);
      auditPipelineStep(10, dbUrlFields(row));
      auditDbRow(dbUrlFields(row));
      assertRowUrlFields(10, row);
      return row;
    }

    if (error) {
      console.error("[UPLOAD] INSERT error:", error.message, error);
      const next = omitMissingOptionalColumn(payload, error.message, PHOTO_OPTIONAL_COLUMNS);
      if (next) {
        if (!isUsablePhotoUrl(String(next.file_url ?? ""))) {
          auditStop(9, "INSERT retry would lose file_url", next);
        }
        payload = next;
        auditDbInsert({ ...payload, _retry: true });
        continue;
      }

      logSaveErrorFull("photo", error);
      throw new Error(error.message);
    }

    auditStop(9, "INSERT returned neither data nor error");
  }
}

async function verifyImageFetchAfterInsert(
  row: Record<string, unknown>,
  upload: PhotoUploadResult,
  photoId: string,
  authUserId: string
): Promise<string> {
  const url =
    String(row.file_url ?? "").trim() ||
    String(row.photo_url ?? "").trim() ||
    String(row.uri ?? "").trim();

  assertAuditValue(10, "image URL from row", url, true);

  const fetchResult = await verifyImageUrlHttp200(url);
  auditImageFetch({ step: "post-insert", url, ...fetchResult });

  if (!fetchResult.ok) {
    await rollbackInsertedPhoto(photoId, authUserId, upload);
    auditStop(10, "image URL from DB row is not HTTP 200 — row and storage removed", {
      url,
      ...fetchResult,
    });
  }

  const resolved = await resolvePhotoDisplayUrl(row);
  auditUpload("resolvePhotoDisplayUrl", resolved);

  if (!isUsablePhotoUrl(resolved)) {
    await rollbackInsertedPhoto(photoId, authUserId, upload);
    auditStop(10, "resolvePhotoDisplayUrl did not return https URL — row and storage removed", {
      url,
      resolved,
    });
  }

  const displayCheck = await verifyImageUrlHttp200(resolved);
  if (!displayCheck.ok) {
    await rollbackInsertedPhoto(photoId, authUserId, upload);
    auditStop(12, "PhotoCard display URL is not HTTP 200 — row and storage removed", {
      resolved,
      ...displayCheck,
    });
  }

  return resolved;
}

export async function createPhotoRecord(input: {
  id: string;
  propertyId: string;
  caption: string;
  date: string;
  category: string;
  upload: PhotoUploadResult;
}): Promise<PhotoRecord> {
  const authUserId = await resolveAuthUserId();
  const propertyId = (input.propertyId ?? "").trim();

  if (!propertyId) throw new Error("Property is required.");

  await assertPropertyOwnedByUser(propertyId, authUserId);

  console.log("[UPLOAD] === START photo save ===", {
    photoId: input.id,
    propertyId,
    category: input.category,
    bucket: input.upload.bucket,
    storagePath: input.upload.storagePath,
    urlMethod: input.upload.urlMethod,
  });

  const inserted = await insertPhotoRow(
    authUserId,
    {
      id: input.id,
      propertyId,
      caption: input.caption,
      date: input.date,
      category: input.category,
    },
    input.upload
  );

  const fetched = await selectPhotoRow(input.id, authUserId);
  auditFetchedRow(dbUrlFields(fetched));
  assertRowUrlFields(10, fetched);

  const displayUrl = await verifyImageFetchAfterInsert(
    fetched,
    input.upload,
    input.id,
    authUserId
  );

  const saved = await normalizePhotoItemAsync({ ...fetched, uri: displayUrl });

  auditPipelineStep(12, saved.uri);
  auditPhotoCardUri(saved.uri);

  console.log("[UPLOAD] === COMPLETE ===", {
    photoId: input.id,
    uri: saved.uri,
    bucket: input.upload.bucket,
  });
  return saved;
}

/** Upload to the correct storage bucket, then insert into public.photos. */
export async function savePhoto(input: SavePhotoInput): Promise<PhotoRecord> {
  return runSaveWithRetry("photos", "upload", { id: input.id, propertyId: input.propertyId }, async () => {
    const authUserId = await resolveAuthUserId();
    const propertyId = (input.propertyId ?? "").trim();

    if (!propertyId) throw new Error("Property is required.");
    if (!input.uri?.trim()) throw new Error("Please choose a photo first.");

    await assertPropertyOwnedByUser(propertyId, authUserId);

    const photoType = input.photoType ?? photoKindFromCategory(input.category);

    auditUpload("savePhoto.start", {
      photoId: input.id,
      propertyId,
      category: input.category,
      photoType,
      expectedBucket: getPhotoBucket(photoType),
    });

    const upload = await uploadPhotoToBucket(authUserId, input.uri, photoType);

    return createPhotoRecord({
      id: input.id,
      propertyId,
      caption: input.caption ?? "",
      date: input.date ?? "",
      category: input.category ?? "general",
      upload,
    });
  });
}

/** @deprecated Use savePhoto — kept for callers migrating gradually. */
export async function savePropertyPhoto(input: SavePhotoInput): Promise<PhotoRecord> {
  return savePhoto({ ...input, photoType: input.photoType ?? "property" });
}

/** Update caption/category only — does not re-upload the image. */
export async function updatePhoto(
  id: string,
  updates: { caption?: string; category?: string }
): Promise<void> {
  return runSaveWithRetry("photos", "update", { id, updates }, async () => {
    const authUserId = await resolveAuthUserId();
    const payload: Record<string, unknown> = {};

    if (updates.caption !== undefined) payload.caption = updates.caption;
    if (updates.category !== undefined) payload.category = updates.category;

    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase.from("photos").update(payload).eq("id", id).eq("user_id", authUserId);
    if (error) throw new Error(error.message);
  });
}

export async function deletePhoto(id: string): Promise<{ storageWarning?: string }> {
  const authUserId = await resolveAuthUserId();
  const { data: row, error: fetchError } = await supabase
    .from("photos")
    .select("id, uri, photo_url, file_url, storage_path, storage_bucket, category")
    .eq("id", id)
    .eq("user_id", authUserId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase.from("photos").delete().eq("id", id).eq("user_id", authUserId);
  if (error) throw new Error(error.message);

  if (!row) return {};

  const category = String(row.category ?? "property");
  const bucket = (String(row.storage_bucket ?? "").trim() || getPhotoBucket(category)) as StorageBucket;
  const url =
    String(row.file_url ?? "").trim() ||
    String(row.photo_url ?? "").trim() ||
    String(row.uri ?? "").trim();
  const path =
    String(row.storage_path ?? "").trim() ||
    (url ? storagePathFromUrl(bucket, url) : null);

  if (!path && !url) return {};

  try {
    if (path) {
      const { error: remErr } = await supabase.storage.from(bucket).remove([path]);
      if (remErr) return { storageWarning: remErr.message };
    } else if (url) {
      await deleteFromStorageReporting(bucket, url);
    }
  } catch (e) {
    return { storageWarning: e instanceof Error ? e.message : String(e) };
  }
  return {};
}

async function deleteFromStorageReporting(bucket: StorageBucket, fileUrl: string) {
  const path = storagePathFromUrl(bucket, fileUrl);
  if (!path) throw new Error("Could not resolve storage path for cleanup.");
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}

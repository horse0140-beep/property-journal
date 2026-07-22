import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import { showRealSaveError } from "@/lib/realSaveError";
import { auditPipelineStep, auditUpload } from "@/lib/photoUploadAudit";
import {
  pickDocument,
  pickImageFromLibrary,
  takePhoto,
  type PickedDocument,
  type PickedImage,
} from "@/lib/fileUtils";
import type { Document } from "@/data/demoData";
import { getPhotoBucket, type StorageBucket } from "@/services/storageBuckets";

export type { StorageBucket } from "@/services/storageBuckets";

export type UploadPhase = "picking" | "reading" | "uploading" | "complete";

export type UploadProgress = {
  phase: UploadPhase;
  percent: number;
};

export type UploadProgressCallback = (progress: UploadProgress) => void;

export type UploadedFile = {
  bucket: StorageBucket;
  path: string;
  url: string;
  isPublic: boolean;
  mimeType?: string;
  urlMethod?: "getPublicUrl" | "createSignedUrl";
  /** Raw Supabase Storage upload response (when available). */
  uploadResponse?: { id?: string; path?: string; fullPath?: string } | null;
};

export type PickedUpload = {
  localUri: string;
  name: string;
  mimeType?: string;
  formattedSize: string;
  fileType: "pdf" | "image" | "other";
};

/** Buckets that use signed URLs (private). property-photos is public (migration 025). */
const PRIVATE_BUCKETS = new Set<StorageBucket>([
  "repair-photos",
  "before-after-photos",
  "receipts",
  "warranties",
  "documents",
  "reports",
  "leases",
  "inspection-files",
]);

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function extensionFromUri(uri: string, fallback = "jpg"): string {
  const clean = uri.split("?")[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match?.[1]?.toLowerCase();
  // Reject nonsense "extensions" from names like "My Receipt" (no real dot-ext).
  if (!ext || ext.length > 5 || /\s/.test(ext)) return fallback;
  return ext;
}

function extensionFromMime(mimeType?: string): string | null {
  if (!mimeType) return null;
  const lower = mimeType.toLowerCase();
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("heic")) return "heic";
  if (lower.includes("gif")) return "gif";
  if (lower.includes("wordprocessingml") || lower.endsWith("docx")) return "docx";
  if (lower === "application/msword" || lower.endsWith("doc")) return "doc";
  return null;
}

/** Safe storage object name: no spaces, always has a real file extension. */
export function buildStorageObjectName(
  localUri: string,
  preferredName?: string,
  mimeType?: string
): string {
  const ext =
    extensionFromMime(mimeType) ??
    extensionFromUri(localUri, preferredName ? extensionFromUri(preferredName, "bin") : "bin");

  const rawBase = (preferredName ?? "")
    .split(/[/\\]/)
    .pop()
    ?.replace(/\.[^.]+$/, "")
    ?.trim();

  const slug = (rawBase || `file_${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const base = slug || `file_${Date.now()}`;
  return `${base}_${Date.now().toString(36)}.${ext}`;
}

function guessContentType(uri: string, mimeType?: string): string {
  if (mimeType) return mimeType;
  const ext = extensionFromUri(uri, "bin");
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function isRemoteUri(uri?: string | null): boolean {
  if (!uri) return false;
  return uri.startsWith("http://") || uri.startsWith("https://");
}

export function bucketForDocumentCategory(category: Document["category"]): StorageBucket {
  if (category === "receipt") return "receipts";
  if (category === "warranty") return "warranties";
  if (category === "inspection") return "inspection-files";
  if (category === "contract") return "leases";
  return "documents";
}

export function bucketForRepairAsset(kind: "photo" | "receipt"): StorageBucket {
  return kind === "receipt" ? "receipts" : getPhotoBucket("repair");
}

export function bucketForPropertyPhoto(): StorageBucket {
  return getPhotoBucket("property");
}

export function bucketForReport(): StorageBucket {
  return "reports";
}

export function showUploadError(error: unknown, title = "Upload Error"): void {
  showRealSaveError("upload", title, error);
}

function storageConfigMessage(error: { message?: string }): string | null {
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("bucket not found") || (msg.includes("not found") && msg.includes("bucket"))) {
    return "Storage is not configured yet. Please create the Property Journal uploads bucket in Supabase.";
  }
  if (msg.includes("row-level security") || msg.includes("policy")) {
    return "Storage upload was blocked. Check Supabase storage policies for this bucket.";
  }
  return null;
}

function wrapStorageError(error: {
  message: string;
  statusCode?: string | number;
  error?: string;
  name?: string;
}): Error {
  const friendly = storageConfigMessage(error);
  const parts = [
    friendly ? `${friendly} (raw: ${error.message})` : error.message,
    error.statusCode != null ? `statusCode=${error.statusCode}` : null,
    error.error ? `error=${error.error}` : null,
  ].filter(Boolean);
  return new Error(parts.join(" | "));
}

function reportProgress(onProgress: UploadProgressCallback | undefined, phase: UploadPhase, percent: number) {
  onProgress?.({ phase, percent });
}

async function readLocalFile(
  uri: string,
  onProgress?: UploadProgressCallback
): Promise<{ body: ArrayBuffer; byteLength: number; sizeOnDisk?: number }> {
  reportProgress(onProgress, "reading", 15);

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("Failed to read file.");
    reportProgress(onProgress, "reading", 35);
    const body = await response.arrayBuffer();
    if (!body.byteLength) {
      throw new Error("File read returned 0 bytes (web).");
    }
    return { body, byteLength: body.byteLength };
  }

  // content:// URIs: prefer copy/fetch-readable file:// from picker (fileUtils).
  // Still attempt read; fail clearly if unreadable or empty.
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error(`File not found on device: ${uri}`);
  }
  const sizeOnDisk = "size" in info ? info.size : undefined;
  if (sizeOnDisk === 0) {
    throw new Error("Selected file is 0 bytes on disk.");
  }

  let body: ArrayBuffer;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) {
      throw new Error("File read returned empty base64.");
    }
    body = base64ToArrayBuffer(base64);
  } catch (readErr) {
    // Fallback for stubborn content:// URIs
    if (uri.startsWith("content://") || uri.startsWith("file://")) {
      try {
        const response = await fetch(uri);
        if (!response.ok) throw new Error(`fetch failed HTTP ${response.status}`);
        body = await response.arrayBuffer();
      } catch (fetchErr) {
        const a = readErr instanceof Error ? readErr.message : String(readErr);
        const b = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        throw new Error(`Unable to read local file bytes. read=${a}; fetch=${b}; uri=${uri}`);
      }
    } else {
      throw readErr;
    }
  }

  reportProgress(onProgress, "reading", 40);
  if (!body.byteLength) {
    throw new Error(`File read returned 0 bytes. uri=${uri} sizeOnDisk=${sizeOnDisk ?? "unknown"}`);
  }
  return { body, byteLength: body.byteLength, sizeOnDisk };
}

async function resolveAccessibleUrl(
  bucket: StorageBucket,
  path: string
): Promise<{ url: string; isPublic: boolean; urlMethod: "getPublicUrl" | "createSignedUrl" }> {
  const objectPath = path.trim();
  if (!objectPath) {
    throw wrapStorageError({ message: "Storage path is empty." });
  }

  const createSigned = async (): Promise<{
    url: string;
    isPublic: boolean;
    urlMethod: "createSignedUrl";
  }> => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl?.trim()) {
      throw wrapStorageError(error ?? { message: "Failed to create signed URL." });
    }

    return { url: data.signedUrl.trim(), isPublic: false, urlMethod: "createSignedUrl" };
  };

  if (PRIVATE_BUCKETS.has(bucket)) {
    return createSigned();
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = data.publicUrl?.trim() ?? "";

  if (publicUrl) {
    const check = await verifyImageUrlHttp200(publicUrl);
    auditUpload("getPublicUrl probe", { bucket, publicUrl, ...check });
    if (check.ok) {
      return { url: publicUrl, isPublic: true, urlMethod: "getPublicUrl" };
    }
    console.warn("[UPLOAD] publicUrl not HTTP 200 — falling back to createSignedUrl:", publicUrl);
  }

  return createSigned();
}

/** HEAD probe — requires HTTP 200 (falls back to ranged GET when HEAD is unsupported). */
export async function verifyImageUrlHttp200(
  url: string
): Promise<{ ok: boolean; status?: number; method?: string; contentType?: string; error?: string }> {
  const target = url.trim();
  if (!target.startsWith("http://") && !target.startsWith("https://")) {
    return { ok: false, error: "not http(s)" };
  }

  try {
    const head = await fetch(target, { method: "HEAD" });
    const headType = head.headers.get("content-type") ?? undefined;
    if (head.status === 200) {
      return { ok: true, status: 200, method: "HEAD", contentType: headType };
    }

    const get = await fetch(target, { method: "GET", headers: { Range: "bytes=0-1023" } });
    const getType = get.headers.get("content-type") ?? undefined;
    const ok = get.status === 200 || get.status === 206;
    return {
      ok,
      status: get.status,
      method: "GET",
      contentType: getType,
      error: ok ? undefined : `HTTP ${get.status}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** @deprecated Prefer verifyImageUrlHttp200 */
export async function verifyImageUrlFetchable(
  url: string
): Promise<{ ok: boolean; status?: number; contentType?: string; error?: string }> {
  const result = await verifyImageUrlHttp200(url);
  return {
    ok: result.ok,
    status: result.status,
    contentType: result.contentType,
    error: result.error,
  };
}

export async function verifyLocalFileExists(
  localUri: string
): Promise<{ exists: boolean; size?: number; error?: string }> {
  if (Platform.OS === "web") {
    try {
      // blob:/data: URLs often reject HEAD — use GET and measure bytes.
      if (localUri.startsWith("blob:") || localUri.startsWith("data:")) {
        const res = await fetch(localUri);
        if (!res.ok) return { exists: false, error: `HTTP ${res.status}` };
        const buf = await res.arrayBuffer();
        return { exists: buf.byteLength > 0, size: buf.byteLength };
      }
      const res = await fetch(localUri, { method: "HEAD" });
      if (res.ok) {
        const len = res.headers.get("content-length");
        return {
          exists: true,
          size: len ? Number(len) : undefined,
        };
      }
      // Fallback GET when HEAD unsupported
      const get = await fetch(localUri);
      if (!get.ok) return { exists: false, error: `HTTP ${get.status}` };
      const buf = await get.arrayBuffer();
      return { exists: buf.byteLength > 0, size: buf.byteLength };
    } catch (e) {
      return { exists: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      return { exists: false, error: "file not found on device" };
    }
    return { exists: true, size: "size" in info ? info.size : undefined };
  } catch (e) {
    return { exists: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteStorageObject(bucket: StorageBucket, path: string): Promise<void> {
  const objectPath = path.trim();
  if (!objectPath) return;

  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) {
    console.warn("[UPLOAD] storage cleanup failed:", { bucket, path: objectPath, error: error.message });
  } else {
    console.log("[UPLOAD] storage object deleted after failed verification:", { bucket, path: objectPath });
  }
}

/** Confirm bucket exists and is reachable for the authenticated user. */
export async function verifyStorageBucketExists(
  bucket: StorageBucket
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function uploadLocalFile(
  userId: string,
  bucket: StorageBucket,
  localUri: string,
  fileName?: string,
  onProgress?: UploadProgressCallback,
  mimeType?: string
): Promise<UploadedFile> {
  if (!userId) throw new Error("You must be signed in to upload files.");
  if (!localUri) throw new Error("No file selected.");

  const fileCheck = await verifyLocalFileExists(localUri);
  auditPipelineStep(3, { localUri, ...fileCheck });
  if (!fileCheck.exists) {
    throw new Error(fileCheck.error ?? "File not found on device.");
  }
  if (fileCheck.size === 0) {
    throw new Error("Selected file is 0 bytes — nothing to upload.");
  }

  reportProgress(onProgress, "uploading", 45);

  const safeName = buildStorageObjectName(localUri, fileName, mimeType);
  const path = `${userId}/${safeName}`;
  const contentType = guessContentType(localUri, mimeType);

  const allowedMime =
    contentType === "image/jpeg" ||
    contentType === "image/png" ||
    contentType === "application/pdf" ||
    contentType.startsWith("image/") ||
    contentType === "application/msword" ||
    contentType.includes("wordprocessingml") ||
    contentType === "application/octet-stream";

  if (!allowedMime) {
    throw new Error(`Unsupported MIME type for upload: ${contentType}`);
  }

  const uploadRequest = { bucket, path, contentType, userId, size: fileCheck.size };
  auditPipelineStep(4, uploadRequest);
  auditUpload("uploadRequest", uploadRequest);

  const { body: fileBody, byteLength, sizeOnDisk } = await readLocalFile(localUri, onProgress);
  if (!byteLength) {
    throw new Error("Upload body is empty (0 bytes) after reading local file.");
  }
  console.log("[UPLOAD] file body ready", { byteLength, sizeOnDisk, contentType, path, bucket });

  reportProgress(onProgress, "uploading", 70);

  const uploadBytes = new Uint8Array(fileBody);
  const { data: uploadData, error } = await supabase.storage.from(bucket).upload(path, uploadBytes, {
    contentType,
    upsert: true,
  });

  auditPipelineStep(5, error ? { error: error.message, ...error } : uploadData);
  auditUpload("uploadResponse", error ?? uploadData);

  if (error) throw wrapStorageError(error);

  reportProgress(onProgress, "uploading", 90);

  auditPipelineStep(6, path);
  auditUpload("storagePath", path);

  const { url, isPublic, urlMethod } = await resolveAccessibleUrl(bucket, path);
  auditPipelineStep(7, { urlMethod, url, isPublic, bucket });
  auditUpload("urlResolution", { urlMethod, url, isPublic, bucket });

  if (isPublic && url) {
    const check = await verifyImageUrlHttp200(url);
    if (!check.ok) {
      console.warn("[UPLOAD] public URL verify failed (non-fatal):", check);
    }
  }

  reportProgress(onProgress, "complete", 100);

  return {
    bucket,
    path,
    url,
    isPublic,
    mimeType: contentType,
    urlMethod,
    uploadResponse: uploadData,
  };
}

/** Confirm an object exists in Supabase Storage after upload. */
export async function verifyStorageObjectExists(
  bucket: StorageBucket,
  path: string
): Promise<{ exists: boolean; error?: string }> {
  const objectPath = path.trim();
  if (!objectPath) {
    return { exists: false, error: "empty path" };
  }

  const { data, error } = await supabase.storage.from(bucket).download(objectPath);

  if (error) {
    return { exists: false, error: error.message };
  }

  return { exists: data != null };
}

/** Upload local file if needed; returns existing remote URL unchanged. */
export async function uploadLocalFileIfNeeded(
  userId: string,
  bucket: StorageBucket,
  uri: string | undefined,
  fileName?: string,
  onProgress?: UploadProgressCallback,
  mimeType?: string
): Promise<string | undefined> {
  if (!uri) return undefined;
  if (isRemoteUri(uri)) return uri;

  const uploaded = await uploadLocalFile(userId, bucket, uri, fileName, onProgress, mimeType);
  return uploaded.url;
}

/** Backward-compatible helper used by HomeWiseContext. */
export async function uploadToStorage(
  userId: string,
  bucket: StorageBucket,
  localUri: string,
  fileName?: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const uploaded = await uploadLocalFile(userId, bucket, localUri, fileName, onProgress);
  return uploaded.url;
}

export async function uploadReportPdf(
  userId: string,
  localUri: string,
  reportName?: string,
  onProgress?: UploadProgressCallback
): Promise<UploadedFile> {
  const name = reportName ?? `report_${Date.now()}.pdf`;
  return uploadLocalFile(userId, "reports", localUri, name.endsWith(".pdf") ? name : `${name}.pdf`, onProgress);
}

function pickedDocumentToUpload(doc: PickedDocument): PickedUpload {
  const fileType: PickedUpload["fileType"] = doc.mimeType?.includes("pdf")
    ? "pdf"
    : doc.mimeType?.includes("image")
      ? "image"
      : "other";

  return {
    localUri: doc.uri,
    name: doc.name,
    mimeType: doc.mimeType,
    formattedSize: doc.formattedSize,
    fileType,
  };
}

function pickedImageToUpload(image: PickedImage, name?: string): PickedUpload {
  return {
    localUri: image.uri,
    name: name ?? `photo_${Date.now()}.jpg`,
    mimeType: image.mimeType ?? "image/jpeg",
    formattedSize: formatBytes(image.fileSize ?? 0),
    fileType: "image",
  };
}

export async function pickDocumentForUpload(
  onProgress?: UploadProgressCallback
): Promise<PickedUpload | null> {
  reportProgress(onProgress, "picking", 5);
  const result = await pickDocument();
  if (!result) return null;
  return pickedDocumentToUpload(result);
}

export async function pickImageForUpload(
  onProgress?: UploadProgressCallback
): Promise<PickedUpload | null> {
  reportProgress(onProgress, "picking", 5);
  const results = await pickImageFromLibrary({ allowsMultiple: false, allowsEditing: false });
  if (!results?.length) return null;
  const picked = pickedImageToUpload(results[0]);
  auditPipelineStep(1, {
    source: "library",
    localUri: picked.localUri,
    name: picked.name,
    mimeType: picked.mimeType,
    formattedSize: picked.formattedSize,
  });
  return picked;
}

export async function pickCameraForUpload(
  onProgress?: UploadProgressCallback
): Promise<PickedUpload | null> {
  reportProgress(onProgress, "picking", 5);
  const result = await takePhoto({ allowsEditing: false });
  if (!result) return null;
  const picked = pickedImageToUpload(result);
  auditPipelineStep(1, {
    source: "camera",
    localUri: picked.localUri,
    name: picked.name,
    mimeType: picked.mimeType,
    formattedSize: picked.formattedSize,
  });
  return picked;
}

export async function pickAndUploadDocument(
  userId: string,
  category: Document["category"],
  onProgress?: UploadProgressCallback
): Promise<{ upload: UploadedFile; picked: PickedUpload } | null> {
  try {
    const picked = await pickDocumentForUpload(onProgress);
    if (!picked) return null;

    const bucket = bucketForDocumentCategory(category);
    const upload = await uploadLocalFile(userId, bucket, picked.localUri, picked.name, onProgress);
    return { upload, picked };
  } catch (e) {
    showUploadError(e);
    return null;
  }
}

export async function pickAndUploadImage(
  userId: string,
  bucket: StorageBucket,
  source: "library" | "camera" = "library",
  onProgress?: UploadProgressCallback
): Promise<{ upload: UploadedFile; picked: PickedUpload } | null> {
  try {
    const picked =
      source === "camera"
        ? await pickCameraForUpload(onProgress)
        : await pickImageForUpload(onProgress);

    if (!picked) return null;

    const upload = await uploadLocalFile(userId, bucket, picked.localUri, picked.name, onProgress);
    return { upload, picked };
  } catch (e) {
    showUploadError(e);
    return null;
  }
}

export async function getAccessibleUrl(bucket: StorageBucket, pathOrUrl: string): Promise<string> {
  if (isRemoteUri(pathOrUrl)) return pathOrUrl;

  const marker = `/object/public/${bucket}/`;
  const signedMarker = `/object/sign/${bucket}/`;

  if (pathOrUrl.includes(marker)) {
    return pathOrUrl;
  }

  if (pathOrUrl.includes(signedMarker)) {
    return pathOrUrl;
  }

  const path = pathOrUrl.includes("/") ? pathOrUrl : pathOrUrl;
  const { url } = await resolveAccessibleUrl(bucket, path);
  return url;
}

export function storagePathFromUrl(bucket: StorageBucket, fileUrl: string): string | null {
  const publicMarker = `/object/public/${bucket}/`;
  const signedMarker = `/object/sign/${bucket}/`;

  let idx = fileUrl.indexOf(publicMarker);
  if (idx !== -1) return decodeURIComponent(fileUrl.slice(idx + publicMarker.length).split("?")[0]);

  idx = fileUrl.indexOf(signedMarker);
  if (idx !== -1) return decodeURIComponent(fileUrl.slice(idx + signedMarker.length).split("?")[0]);

  return null;
}

export async function deleteFromStorage(bucket: StorageBucket, fileUrl: string) {
  try {
    const path = storagePathFromUrl(bucket, fileUrl);
    if (!path) return;
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // ignore storage cleanup errors
  }
}

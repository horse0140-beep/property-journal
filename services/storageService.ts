import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";
import {
  pickDocument,
  pickImageFromLibrary,
  takePhoto,
  type PickedDocument,
  type PickedImage,
} from "@/lib/fileUtils";
import type { Document } from "@/data/demoData";

export type StorageBucket =
  | "property-photos"
  | "repair-photos"
  | "receipts"
  | "warranties"
  | "documents"
  | "reports"
  | "leases"
  | "inspection-files";

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
};

export type PickedUpload = {
  localUri: string;
  name: string;
  mimeType?: string;
  formattedSize: string;
  fileType: "pdf" | "image" | "other";
};

/** Buckets that use signed URLs (private). Others use public URLs. */
const PRIVATE_BUCKETS = new Set<StorageBucket>([
  "repair-photos",
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
  return match?.[1]?.toLowerCase() ?? fallback;
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
  return kind === "receipt" ? "receipts" : "repair-photos";
}

export function bucketForPropertyPhoto(): StorageBucket {
  return "property-photos";
}

export function bucketForReport(): StorageBucket {
  return "reports";
}

export function showUploadError(error: unknown, title = "Upload Failed"): void {
  const message = error instanceof Error ? error.message : "Could not upload file.";
  Alert.alert(title, message);
}

function reportProgress(onProgress: UploadProgressCallback | undefined, phase: UploadPhase, percent: number) {
  onProgress?.({ phase, percent });
}

async function readLocalFile(uri: string, onProgress?: UploadProgressCallback): Promise<ArrayBuffer> {
  reportProgress(onProgress, "reading", 15);

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("Failed to read file.");
    reportProgress(onProgress, "reading", 35);
    return response.arrayBuffer();
  }

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error("File not found on device.");
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  reportProgress(onProgress, "reading", 40);
  return base64ToArrayBuffer(base64);
}

async function resolveAccessibleUrl(bucket: StorageBucket, path: string): Promise<{ url: string; isPublic: boolean }> {
  if (PRIVATE_BUCKETS.has(bucket)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Failed to create signed URL.");
    }

    return { url: data.signedUrl, isPublic: false };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, isPublic: true };
}

export async function uploadLocalFile(
  userId: string,
  bucket: StorageBucket,
  localUri: string,
  fileName?: string,
  onProgress?: UploadProgressCallback
): Promise<UploadedFile> {
  if (!userId) throw new Error("You must be signed in to upload files.");
  if (!localUri) throw new Error("No file selected.");

  reportProgress(onProgress, "uploading", 45);

  const ext = extensionFromUri(localUri);
  const safeName = fileName ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${userId}/${safeName}`;
  const contentType = guessContentType(localUri);

  const fileBody = await readLocalFile(localUri, onProgress);

  reportProgress(onProgress, "uploading", 70);

  const { error } = await supabase.storage.from(bucket).upload(path, fileBody, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(error.message);

  reportProgress(onProgress, "uploading", 90);

  const { url, isPublic } = await resolveAccessibleUrl(bucket, path);

  reportProgress(onProgress, "complete", 100);

  return { bucket, path, url, isPublic };
}

/** Upload local file if needed; returns existing remote URL unchanged. */
export async function uploadLocalFileIfNeeded(
  userId: string,
  bucket: StorageBucket,
  uri: string | undefined,
  fileName?: string,
  onProgress?: UploadProgressCallback
): Promise<string | undefined> {
  if (!uri) return undefined;
  if (isRemoteUri(uri)) return uri;

  const uploaded = await uploadLocalFile(userId, bucket, uri, fileName, onProgress);
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
  const results = await pickImageFromLibrary({ allowsMultiple: false });
  if (!results?.length) return null;
  return pickedImageToUpload(results[0]);
}

export async function pickCameraForUpload(
  onProgress?: UploadProgressCallback
): Promise<PickedUpload | null> {
  reportProgress(onProgress, "picking", 5);
  const result = await takePhoto();
  if (!result) return null;
  return pickedImageToUpload(result);
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

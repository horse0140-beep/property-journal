import type { Document } from "@/data/demoData";
import { isRemoteUri } from "@/services/storageService";

type DocumentLike = Document | Record<string, unknown>;

const URL_KEYS = ["fileUri", "file_url", "fileUrl", "uri", "url"] as const;

/** Resolve the best available file URL from a document row. */
export function resolveDocumentUrl(doc: DocumentLike | null | undefined): string {
  if (!doc) return "";

  const record = doc as Record<string, unknown>;
  for (const key of URL_KEYS) {
    const value = String(record[key] ?? "").trim();
    if (value) return value;
  }

  return "";
}

export function hasDocumentPreviewUrl(url: string | null | undefined): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return false;
  return (
    isRemoteUri(trimmed) ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("content:")
  );
}

export function isImageDocument(doc: DocumentLike, url: string): boolean {
  const record = doc as Record<string, unknown>;
  const fileType = String(record.fileType ?? record.file_type ?? "").toLowerCase();
  if (fileType === "image") return true;
  return /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(url);
}

export function isPdfDocument(doc: DocumentLike, url: string): boolean {
  const record = doc as Record<string, unknown>;
  const fileType = String(record.fileType ?? record.file_type ?? "").toLowerCase();
  if (fileType === "pdf") return true;
  return /\.pdf(\?|$)/i.test(url);
}

export function logDocumentCardTap(doc: DocumentLike): string {
  const record = doc as Record<string, unknown>;
  console.log("[DocumentCard] tapped", {
    id: record.id,
    title: record.title,
    category: record.category,
  });
  const url = resolveDocumentUrl(doc);
  console.log("[DocumentCard] resolvedUrl:", url || "(none)");
  return url;
}

export function documentUrlStatus(url: string): string {
  if (!url.trim()) return "No file attached";
  if (isRemoteUri(url)) return "File attached — cloud URL available";
  return "File attached — local file";
}

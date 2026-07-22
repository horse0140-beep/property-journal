import { supabase } from "@/lib/supabase";
import { omitMissingOptionalColumn } from "@/lib/dbErrors";
import { logSaveErrorFull } from "@/lib/saveLogs";
import { isInsertOkSelectFailed } from "@/lib/realSaveError";
import { fetchInsertedRow, runSaveWithRetry } from "@/lib/saveReliability";
import { isRemoteUri, bucketForDocumentCategory, storagePathFromUrl } from "@/services/storageService";
import {
  setTextField,
  toNumericOrNull,
} from "@/lib/dbSanitize";
import {
  contractorToRow,
  documentToRow,
  paintToRow,
  rowToContractor,
  rowToDocument,
  rowToPaint,
} from "@/types/database";
import type { Document, PaintColor, Contractor } from "@/data/demoData";

type VaultTable = "documents" | "receipts" | "warranties";

const DOCUMENT_OPTIONAL_COLUMNS = ["tags"] as const;

async function insertVaultRow(
  table: VaultTable,
  userId: string,
  doc: Document
): Promise<Record<string, unknown>> {
  let payload = documentToRow(userId, doc, table);

  for (;;) {
    console.log("[DOCUMENT] DB insert attempt", { table, payload });
    const { data, error } = await supabase.from(table).insert(payload).select().single();

    if (!error) {
      console.log("[DOCUMENT] DB insert OK", { table, id: (data as { id?: string })?.id });
      return data!;
    }

    console.warn("[DOCUMENT] DB insert error", {
      table,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload,
    });

    if (isInsertOkSelectFailed(error)) {
      console.warn("[DOCUMENT] PGRST116 / select-after-insert — fetching by id", { id: doc.id });
      const fetched = await fetchInsertedRow(table, doc.id, userId);
      if (fetched) return fetched;
      // Insert succeeded; SELECT blocked — treat as success with known payload.
      return { ...documentToRow(userId, doc, table), id: doc.id };
    }

    const next = omitMissingOptionalColumn(payload, error.message, DOCUMENT_OPTIONAL_COLUMNS);
    if (!next) {
      logSaveErrorFull("document", error);
      const parts = [
        error.message,
        error.code ? `code=${error.code}` : null,
        error.details ? `details=${error.details}` : null,
        error.hint ? `hint=${error.hint}` : null,
        `table=${table}`,
      ].filter(Boolean);
      throw new Error(parts.join(" | "));
    }
    payload = next;
  }
}

function tableForCategory(category: Document["category"]): VaultTable {
  if (category === "receipt") return "receipts";
  if (category === "warranty") return "warranties";
  return "documents";
}

function handleWriteError<T>(type: string, fallback: T, data: unknown, error: { message: string; code?: string } | null): T {
  if (error) {
    if (isInsertOkSelectFailed(error)) {
      return fallback;
    }
    logSaveErrorFull(type, error);
    throw new Error(error.message);
  }
  return (data as T) ?? fallback;
}

export async function fetchAllVaultDocuments(userId: string): Promise<Document[]> {
  const [docsRes, receiptsRes, warrantiesRes] = await Promise.all([
    supabase.from("documents").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("receipts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("warranties").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  if (docsRes.error) throw new Error(docsRes.error.message);
  if (receiptsRes.error) throw new Error(receiptsRes.error.message);
  if (warrantiesRes.error) throw new Error(warrantiesRes.error.message);

  const docs = (docsRes.data ?? []).map((r) => rowToDocument(r));
  const receipts = (receiptsRes.data ?? []).map((r) => rowToDocument(r, "receipt"));
  const warranties = (warrantiesRes.data ?? []).map((r) => rowToDocument(r, "warranty"));

  return [...docs, ...receipts, ...warranties].sort((a, b) =>
    (b.uploadDate || "").localeCompare(a.uploadDate || "")
  );
}

export async function createVaultDocument(userId: string, doc: Document): Promise<Document> {
  return runSaveWithRetry("documents", "insert", { id: doc.id, category: doc.category }, async () => {
    const title = (doc.title ?? "").trim();
    const propertyId = (doc.propertyId ?? "").trim();
    const fileUrl = (doc.fileUri ?? "").trim();

    if (!title) throw new Error("Document title is required.");
    if (!propertyId) throw new Error("Property is required.");
    if (!fileUrl) throw new Error("File is required.");
    if (!isRemoteUri(fileUrl)) {
      throw new Error("File must be uploaded before saving.");
    }

    const table = tableForCategory(doc.category);
    const data = await insertVaultRow(table, userId, { ...doc, title, propertyId, fileUri: fileUrl });

    return table === "receipts"
      ? rowToDocument(data, "receipt")
      : table === "warranties"
        ? rowToDocument(data, "warranty")
        : rowToDocument(data);
  });
}

export async function updateVaultDocument(userId: string, doc: Document) {
  const table = tableForCategory(doc.category);
  return runSaveWithRetry(table, "update", { id: doc.id }, async () => {
    const { data, error } = await supabase
      .from(table)
      .update(documentToRow(userId, doc, table))
      .eq("id", doc.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error && isInsertOkSelectFailed(error)) {
      const fetched = await fetchInsertedRow(table, doc.id, userId);
      if (fetched) return rowToDocument(fetched, doc.category === "receipt" ? "receipt" : doc.category === "warranty" ? "warranty" : undefined);
    }

    handleWriteError("document", doc, data, error);
    return rowToDocument(data!, doc.category === "receipt" ? "receipt" : doc.category === "warranty" ? "warranty" : undefined);
  });
}

export async function deleteVaultDocument(userId: string, doc: Document): Promise<{ storageWarning?: string }> {
  const table = tableForCategory(doc.category);
  const { error } = await supabase.from(table).delete().eq("id", doc.id).eq("user_id", userId);
  if (error) throw new Error(error.message);

  const fileUrl = (doc.fileUri ?? "").trim();
  if (!fileUrl || !isRemoteUri(fileUrl)) return {};

  try {
    const bucket = bucketForDocumentCategory(doc.category);
    const path = storagePathFromUrl(bucket, fileUrl);
    if (!path) return { storageWarning: "Could not resolve storage path for document cleanup." };
    const { error: remErr } = await supabase.storage.from(bucket).remove([path]);
    if (remErr) return { storageWarning: remErr.message };
  } catch (e) {
    return { storageWarning: e instanceof Error ? e.message : String(e) };
  }
  return {};
}

export async function fetchContractors(userId: string) {
  const { data, error } = await supabase
    .from("contractors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToContractor(r));
}

export async function createContractor(userId: string, c: Contractor) {
  return runSaveWithRetry("contractors", "insert", { id: c.id }, async () => {
    const { data, error } = await supabase
      .from("contractors")
      .insert(contractorToRow(userId, c))
      .select()
      .single();

    if (error) {
      if (isInsertOkSelectFailed(error)) {
        const fetched = await fetchInsertedRow("contractors", c.id, userId);
        if (fetched) return rowToContractor(fetched);
        return c;
      }
      logSaveErrorFull("contractor", error);
      throw new Error(error.message);
    }

    return rowToContractor(data!);
  });
}

export async function updateContractor(userId: string, id: string, updates: Partial<Contractor>) {
  return runSaveWithRetry("contractors", "update", { id, updates }, async () => {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.trade !== undefined) setTextField(row, "trade", updates.trade);
    if (updates.phone !== undefined) setTextField(row, "phone", updates.phone);
    if (updates.email !== undefined) setTextField(row, "email", updates.email);
    if (updates.website !== undefined) setTextField(row, "website", updates.website);
    if (updates.rating !== undefined) row.rating = toNumericOrNull(updates.rating) ?? 5;
    if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);
    if (updates.lastUsed !== undefined) setTextField(row, "last_used", updates.lastUsed);
    if (updates.licenseNumber !== undefined) setTextField(row, "license_number", updates.licenseNumber);
    if (updates.propertyId !== undefined) row.property_id = updates.propertyId || null;

    if (Object.keys(row).length === 0) return;

    const { data, error } = await supabase.from("contractors").update(row).eq("id", id).eq("user_id", userId).select().single();

    if (error && isInsertOkSelectFailed(error)) {
      const fetched = await fetchInsertedRow("contractors", id, userId);
      if (fetched) return rowToContractor(fetched);
    }

    return handleWriteError("contractor", { id, ...updates }, data, error);
  });
}

export async function deleteContractor(userId: string, id: string) {
  const { error } = await supabase.from("contractors").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function fetchPaintColors(userId: string): Promise<PaintColor[]> {
  const { data, error } = await supabase
    .from("paint_colors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("fetchPaintColors:", error.message);
    return [];
  }

  return (data ?? []).map((r) => rowToPaint(r));
}

export async function createPaintColor(userId: string, p: PaintColor) {
  return runSaveWithRetry("paint_colors", "insert", { id: p.id }, async () => {
    const { data, error } = await supabase
      .from("paint_colors")
      .insert(paintToRow(userId, p))
      .select()
      .single();

    if (error) {
      if (isInsertOkSelectFailed(error)) {
        const fetched = await fetchInsertedRow("paint_colors", p.id, userId);
        if (fetched) return rowToPaint(fetched);
        return p;
      }
      logSaveErrorFull("paint", error);
      throw new Error(error.message);
    }

    return rowToPaint(data!);
  });
}

export async function deletePaintColor(userId: string, id: string) {
  const { error } = await supabase.from("paint_colors").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

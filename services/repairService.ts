import { supabase } from "@/lib/supabase";
import { REPAIR_OPTIONAL_COLUMNS, omitMissingOptionalColumn } from "@/lib/dbErrors";
import {
  fetchInsertedRow,
  isDuplicateKeyError,
  isInsertOkSelectFailed,
  recoverRowAfterLikelyInsert,
  runSaveWithRetry,
} from "@/lib/saveReliability";
import {
  attachSupabaseErrorFields,
  logRepairSaveFailed,
  logRepairSaveStart,
} from "@/lib/maintenanceRepairSave";
import {
  setTextDateFieldOmit,
  setTextField,
} from "@/lib/dbSanitize";
import type { Repair } from "@/data/demoData";
import { repairToRow, rowToRepair } from "@/types/database";

export async function fetchRepairs(userId: string): Promise<Repair[]> {
  const { data, error } = await supabase
    .from("repairs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw attachSupabaseErrorFields(error);
  return (data ?? []).map((r) => rowToRepair(r));
}

async function insertRepairRow(userId: string, item: Repair): Promise<Repair> {
  let payload = repairToRow(userId, item);

  for (;;) {
    const startedAt = logRepairSaveStart(payload);
    const { data, error } = await supabase
      .from("repairs")
      .insert(payload)
      .select()
      .single();

    if (!error) {
      console.log("[REPAIR SAVE SUCCESS]", {
        payload,
        response: data,
        elapsedMs: Date.now() - startedAt,
      });
      return rowToRepair(data!);
    }

    if (isInsertOkSelectFailed(error)) {
      const fetched = await recoverRowAfterLikelyInsert("repairs", item.id, userId, "PGRST116");
      if (fetched) return rowToRepair(fetched);
      return item;
    }

    if (isDuplicateKeyError(error)) {
      const fetched = await recoverRowAfterLikelyInsert("repairs", item.id, userId, "23505");
      if (fetched) return rowToRepair(fetched);
      return item;
    }

    const next = omitMissingOptionalColumn(payload, error.message, REPAIR_OPTIONAL_COLUMNS);
    if (next) {
      payload = next;
      continue;
    }

    logRepairSaveFailed(payload, error, startedAt, error);
    throw attachSupabaseErrorFields(error);
  }
}

export async function createRepair(userId: string, item: Repair): Promise<Repair> {
  return runSaveWithRetry("repairs", "insert", { id: item.id, propertyId: item.propertyId }, async () => {
    return insertRepairRow(userId, item);
  });
}

export async function updateRepair(userId: string, id: string, updates: Partial<Repair>) {
  return runSaveWithRetry("repairs", "update", { id, updates }, async () => {
    const row: Record<string, unknown> = {};

    if (updates.title !== undefined) row.title = updates.title;
    if (updates.date !== undefined) setTextDateFieldOmit(row, "date", updates.date);
    if (updates.cost !== undefined) setTextField(row, "cost", updates.cost);
    if (updates.contractor !== undefined) setTextField(row, "contractor", updates.contractor);
    if (updates.category !== undefined) setTextField(row, "category", updates.category);
    if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);
    if (updates.photoUris !== undefined && updates.photoUris.length > 0) row.photo_urls = updates.photoUris;
    if (updates.receiptUri !== undefined) setTextField(row, "receipt_url", updates.receiptUri);
    if (updates.warrantyExpires !== undefined) setTextDateFieldOmit(row, "warranty_expires", updates.warrantyExpires);

    if (Object.keys(row).length === 0) return;

    const startedAt = logRepairSaveStart({ id, ...row });
    const { data, error } = await supabase.from("repairs").update(row).eq("id", id).eq("user_id", userId).select().single();

    if (error) {
      if (isInsertOkSelectFailed(error)) {
        const fetched = await fetchInsertedRow("repairs", id, userId);
        if (fetched) return;
      }
      logRepairSaveFailed({ id, ...row }, error, startedAt, error);
      throw attachSupabaseErrorFields(error);
    }

    console.log("[REPAIR SAVE SUCCESS]", {
      payload: { id, ...row },
      response: data,
      elapsedMs: Date.now() - startedAt,
    });
    return data ?? { id, ...updates };
  });
}

export async function deleteRepair(userId: string, id: string) {
  const { error } = await supabase.from("repairs").delete().eq("id", id).eq("user_id", userId);
  if (error) throw attachSupabaseErrorFields(error);
}

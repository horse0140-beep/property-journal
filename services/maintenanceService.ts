import { supabase } from "@/lib/supabase";
import { MAINTENANCE_OPTIONAL_COLUMNS, omitMissingOptionalColumn } from "@/lib/dbErrors";
import {
  fetchInsertedRow,
  isInsertOkSelectFailed,
  isRetryableInsertSchemaError,
  resolveInsertedRow,
  runSaveWithRetry,
} from "@/lib/saveReliability";
import {
  attachSupabaseErrorFields,
  logMaintenanceSaveFailed,
  logMaintenanceSaveStart,
} from "@/lib/maintenanceRepairSave";
import {
  setNumericFieldOmit,
  setTextDateFieldOmit,
  setTextField,
} from "@/lib/dbSanitize";
import type { MaintenanceItem } from "@/data/demoData";
import { maintenanceToRow, rowToMaintenance } from "@/types/database";

export async function fetchMaintenanceItems(userId: string): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase
    .from("maintenance_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw attachSupabaseErrorFields(error);
  return (data ?? []).map((r) => rowToMaintenance(r));
}

async function insertMaintenanceRow(
  userId: string,
  item: MaintenanceItem
): Promise<MaintenanceItem> {
  let payload = maintenanceToRow(userId, item);

  for (;;) {
    const startedAt = logMaintenanceSaveStart(payload);
    const { data, error } = await supabase
      .from("maintenance_items")
      .insert(payload)
      .select()
      .single();

    const resolved = await resolveInsertedRow(
      "maintenance_items",
      item.id,
      userId,
      data as Record<string, unknown> | null,
      error,
      item,
      rowToMaintenance
    );
    if (resolved.ok) {
      console.log("[MAINTENANCE SAVE SUCCESS]", {
        payload,
        response: resolved.value,
        elapsedMs: Date.now() - startedAt,
      });
      return resolved.value;
    }

    const insertError = resolved.error;
    const next = omitMissingOptionalColumn(payload, insertError.message ?? "", MAINTENANCE_OPTIONAL_COLUMNS);
    if (next && isRetryableInsertSchemaError(insertError)) {
      payload = next;
      continue;
    }

    logMaintenanceSaveFailed(payload, insertError, startedAt, insertError);
    throw attachSupabaseErrorFields({
      message: insertError.message ?? "Maintenance insert failed.",
      code: insertError.code,
    });
  }
}

export async function createMaintenanceItem(userId: string, item: MaintenanceItem): Promise<MaintenanceItem> {
  return runSaveWithRetry("maintenance_items", "insert", { id: item.id, propertyId: item.propertyId }, async () => {
    return insertMaintenanceRow(userId, item);
  });
}

export async function updateMaintenanceItem(userId: string, id: string, updates: Partial<MaintenanceItem>) {
  return runSaveWithRetry("maintenance_items", "update", { id, updates }, async () => {
    const row: Record<string, unknown> = {};

    if (updates.title !== undefined) row.title = updates.title;
    if (updates.category !== undefined) setTextField(row, "category", updates.category);
    if (updates.lastCompleted !== undefined) setTextDateFieldOmit(row, "last_completed", updates.lastCompleted);
    if (updates.nextDue !== undefined) setTextDateFieldOmit(row, "next_due", updates.nextDue);
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);
    if (updates.intervalDays !== undefined) setNumericFieldOmit(row, "interval_days", updates.intervalDays);
    if (updates.priority !== undefined) row.priority = updates.priority;
    if (updates.recurring === true) row.recurring = true;

    if (Object.keys(row).length === 0) return;

    const startedAt = logMaintenanceSaveStart({ id, ...row });
    const { data, error } = await supabase
      .from("maintenance_items")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (isInsertOkSelectFailed(error)) {
        const fetched = await fetchInsertedRow("maintenance_items", id, userId);
        if (fetched) return;
      }
      logMaintenanceSaveFailed({ id, ...row }, error, startedAt, error);
      throw attachSupabaseErrorFields(error);
    }

    console.log("[MAINTENANCE SAVE SUCCESS]", {
      payload: { id, ...row },
      response: data,
      elapsedMs: Date.now() - startedAt,
    });
    return data ?? { id, ...updates };
  });
}

export async function deleteMaintenanceItem(userId: string, id: string) {
  const { error } = await supabase
    .from("maintenance_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw attachSupabaseErrorFields(error);
}

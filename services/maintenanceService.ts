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
  setTextField,
} from "@/lib/dbSanitize";
import { setIsoDateFieldOmit } from "@/lib/dateForDatabase";
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

export async function updateMaintenanceItem(
  userId: string,
  id: string,
  updates: Partial<MaintenanceItem>
): Promise<MaintenanceItem> {
  return runSaveWithRetry("maintenance_items", "update", { id, updates }, async () => {
    const row: Record<string, unknown> = {};

    if (updates.title !== undefined) row.title = updates.title;
    if (updates.category !== undefined) setTextField(row, "category", updates.category);
    if (updates.lastCompleted !== undefined) {
      setIsoDateFieldOmit(row, "last_completed", updates.lastCompleted, "Last completed");
    }
    if (updates.nextDue !== undefined) {
      setIsoDateFieldOmit(row, "next_due", updates.nextDue, "Next due");
    }
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);
    if (updates.intervalDays !== undefined) setNumericFieldOmit(row, "interval_days", updates.intervalDays);
    if (updates.priority !== undefined) row.priority = updates.priority;
    if (updates.recurring !== undefined) row.recurring = Boolean(updates.recurring);
    // Do not map photoUris → photo_urls. Live maintenance_items has no photo_urls column.

    async function fetchCurrent(): Promise<MaintenanceItem> {
      const fetched = await fetchInsertedRow("maintenance_items", id, userId);
      if (!fetched) {
        throw attachSupabaseErrorFields({
          message: "Maintenance update succeeded but the row could not be reloaded.",
          code: "PGRST116",
        });
      }
      return rowToMaintenance(fetched);
    }

    if (Object.keys(row).length === 0) {
      return fetchCurrent();
    }

    const startedAt = logMaintenanceSaveStart({ id, ...row });
    const { data, error } = await supabase
      .from("maintenance_items")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      // Update may have succeeded while .single() returned PGRST116 — treat as success.
      if (isInsertOkSelectFailed(error)) {
        const recovered = await fetchCurrent();
        console.log("[MAINTENANCE COMPLETE RESPONSE]", {
          recoveredVia: "PGRST116_fetch",
          response: recovered,
          elapsedMs: Date.now() - startedAt,
        });
        return recovered;
      }
      logMaintenanceSaveFailed({ id, ...row }, error, startedAt, error);
      throw attachSupabaseErrorFields(error);
    }

    const saved = rowToMaintenance((data ?? { id, ...row }) as Record<string, unknown>);
    console.log("[MAINTENANCE COMPLETE RESPONSE]", {
      payload: { id, ...row },
      response: saved,
      elapsedMs: Date.now() - startedAt,
    });
    return saved;
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

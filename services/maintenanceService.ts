import { supabase } from "@/lib/supabase";
import { isColumnMissing } from "@/lib/dbErrors";
import {
  setDateFieldNullable,
  setNumericFieldNullable,
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

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToMaintenance(r));
}

export async function createMaintenanceItem(userId: string, item: MaintenanceItem): Promise<MaintenanceItem> {
  const { data, error } = await supabase
    .from("maintenance_items")
    .insert(maintenanceToRow(userId, item))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToMaintenance(data);
}

export async function updateMaintenanceItem(userId: string, id: string, updates: Partial<MaintenanceItem>) {
  const row: Record<string, unknown> = {};

  if (updates.title !== undefined) row.title = updates.title;
  if (updates.category !== undefined) setTextField(row, "category", updates.category);
  if (updates.lastCompleted !== undefined) setDateFieldNullable(row, "last_completed", updates.lastCompleted);
  if (updates.nextDue !== undefined) setDateFieldNullable(row, "next_due", updates.nextDue);
  if (updates.status !== undefined) setTextField(row, "status", updates.status);
  if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);
  if (updates.intervalDays !== undefined) setNumericFieldNullable(row, "interval_days", updates.intervalDays);
  if (updates.priority !== undefined) setTextField(row, "priority", updates.priority);

  if (updates.recurring === true && !isColumnMissing("recurring")) {
    row.recurring = true;
  }

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase
    .from("maintenance_items")
    .update(row)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteMaintenanceItem(userId: string, id: string) {
  const { error } = await supabase
    .from("maintenance_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

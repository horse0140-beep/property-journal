import { supabase } from "@/lib/supabase";
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
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.lastCompleted !== undefined) row.last_completed = updates.lastCompleted;
  if (updates.nextDue !== undefined) row.next_due = updates.nextDue;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.recurring !== undefined) row.recurring = updates.recurring;
  if (updates.intervalDays !== undefined) row.interval_days = updates.intervalDays ?? null;
  if (updates.priority !== undefined) row.priority = updates.priority;

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

import { supabase } from "@/lib/supabase";
import {
  setDateFieldNullable,
  setNumericFieldNullable,
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

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToRepair(r));
}

export async function createRepair(userId: string, item: Repair): Promise<Repair> {
  const { data, error } = await supabase
    .from("repairs")
    .insert(repairToRow(userId, item))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToRepair(data);
}

export async function updateRepair(userId: string, id: string, updates: Partial<Repair>) {
  const row: Record<string, unknown> = {};

  if (updates.title !== undefined) row.title = updates.title;
  if (updates.date !== undefined) setDateFieldNullable(row, "date", updates.date);
  if (updates.cost !== undefined) setNumericFieldNullable(row, "cost", updates.cost);
  if (updates.contractor !== undefined) setTextField(row, "contractor", updates.contractor);
  if (updates.category !== undefined) setTextField(row, "category", updates.category);
  if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);
  if (updates.photoUris !== undefined) row.photo_urls = updates.photoUris;
  if (updates.receiptUri !== undefined) row.receipt_url = updates.receiptUri || null;
  if (updates.warrantyExpires !== undefined) setDateFieldNullable(row, "warranty_expires", updates.warrantyExpires);

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("repairs").update(row).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteRepair(userId: string, id: string) {
  const { error } = await supabase.from("repairs").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

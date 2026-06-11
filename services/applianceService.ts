import { supabase } from "@/lib/supabase";
import type { Appliance } from "@/data/demoData";
import { applianceToRow, rowToAppliance } from "@/types/database";

export async function fetchAppliances(userId: string): Promise<Appliance[]> {
  const { data, error } = await supabase
    .from("appliances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToAppliance(r));
}

export async function createAppliance(userId: string, item: Appliance): Promise<Appliance> {
  const { data, error } = await supabase
    .from("appliances")
    .insert(applianceToRow(userId, item))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToAppliance(data);
}

export async function updateAppliance(userId: string, id: string, updates: Partial<Appliance>) {
  const row: Record<string, unknown> = {};
  const map: [keyof Appliance, string][] = [
    ["name", "name"], ["category", "category"], ["brand", "brand"], ["model", "model"],
    ["serial", "serial"], ["installDate", "install_date"], ["purchasePrice", "purchase_price"],
    ["expectedLifeYears", "expected_life_years"], ["warrantyExpires", "warranty_expires"],
    ["lastService", "last_service"], ["nextService", "next_service"], ["condition", "condition"],
    ["notes", "notes"], ["photoUri", "photo_url"], ["manualUri", "manual_url"], ["receiptUri", "receipt_url"],
  ];
  for (const [appKey, dbKey] of map) {
    if (updates[appKey] !== undefined) {
      row[dbKey] = updates[appKey] ?? null;
    }
  }

  const { error } = await supabase.from("appliances").update(row).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteAppliance(userId: string, id: string) {
  const { error } = await supabase.from("appliances").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

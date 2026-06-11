import { supabase } from "@/lib/supabase";
import type { Property } from "@/data/demoData";
import { propertyToRow, rowToProperty } from "@/types/database";

export async function fetchProperties(userId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToProperty(r));
}

export async function createProperty(userId: string, property: Property): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .insert(propertyToRow(userId, property))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToProperty(data);
}

export async function updateProperty(userId: string, id: string, updates: Partial<Property>) {
  const row: Record<string, unknown> = {};
  if (updates.nickname !== undefined) row.nickname = updates.nickname;
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.city !== undefined) row.city = updates.city;
  if (updates.state !== undefined) row.state = updates.state;
  if (updates.zip !== undefined) row.zip = updates.zip;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.yearBuilt !== undefined) row.year_built = updates.yearBuilt;
  if (updates.squareFeet !== undefined) row.square_feet = updates.squareFeet;
  if (updates.bedrooms !== undefined) row.bedrooms = updates.bedrooms;
  if (updates.bathrooms !== undefined) row.bathrooms = updates.bathrooms;
  if (updates.purchasePrice !== undefined) row.purchase_price = updates.purchasePrice;
  if (updates.estimatedValue !== undefined) row.estimated_value = updates.estimatedValue;
  if (updates.purchaseDate !== undefined) row.purchase_date = updates.purchaseDate;
  if (updates.photoUri !== undefined) row.photo_url = updates.photoUri ?? null;
  if (updates.isSelected !== undefined) row.is_selected = updates.isSelected;

  const { error } = await supabase.from("properties").update(row).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteProperty(userId: string, id: string) {
  const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function clearPropertySelection(userId: string) {
  const { error } = await supabase
    .from("properties")
    .update({ is_selected: false })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setSelectedProperty(userId: string, id: string) {
  await clearPropertySelection(userId);
  const { error } = await supabase
    .from("properties")
    .update({ is_selected: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

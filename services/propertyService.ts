import { supabase } from "@/lib/supabase";
import {
  isMissingSchemaError,
  omitMissingOptionalColumn,
  PROPERTY_OPTIONAL_COLUMNS,
  stripKnownMissingColumns,
} from "@/lib/dbErrors";
import {
  setDateFieldNullable,
  setNumericFieldNullable,
  setTextField,
} from "@/lib/dbSanitize";
import type { Property } from "@/data/demoData";
import { propertyToRow, rowToProperty } from "@/types/database";

async function insertPropertyRow(userId: string, property: Property) {
  let current = stripKnownMissingColumns(
    propertyToRow(userId, property),
    PROPERTY_OPTIONAL_COLUMNS
  );

  for (;;) {
    const { data, error } = await supabase.from("properties").insert(current).select().single();
    if (!error) return rowToProperty(data);
    const next = omitMissingOptionalColumn(current, error.message, PROPERTY_OPTIONAL_COLUMNS);
    if (!next) throw new Error(error.message);
    current = next;
  }
}

async function updatePropertyRow(
  userId: string,
  id: string,
  row: Record<string, unknown>
) {
  let current = stripKnownMissingColumns(row, PROPERTY_OPTIONAL_COLUMNS);

  for (;;) {
    const { error } = await supabase
      .from("properties")
      .update(current)
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) return;
    const next = omitMissingOptionalColumn(current, error.message, PROPERTY_OPTIONAL_COLUMNS);
    if (!next) throw new Error(error.message);
    current = next;
  }
}

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
  return insertPropertyRow(userId, property);
}

export async function updateProperty(userId: string, id: string, updates: Partial<Property>) {
  const row: Record<string, unknown> = {};

  if (updates.nickname !== undefined) setTextField(row, "nickname", updates.nickname);
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.city !== undefined) setTextField(row, "city", updates.city);
  if (updates.state !== undefined) setTextField(row, "state", updates.state);
  if (updates.zip !== undefined) setTextField(row, "zip", updates.zip);
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.yearBuilt !== undefined) setTextField(row, "year_built", updates.yearBuilt);
  if (updates.squareFeet !== undefined) setNumericFieldNullable(row, "square_feet", updates.squareFeet);
  if (updates.bedrooms !== undefined) setNumericFieldNullable(row, "bedrooms", updates.bedrooms);
  if (updates.bathrooms !== undefined) setNumericFieldNullable(row, "bathrooms", updates.bathrooms);
  if (updates.purchasePrice !== undefined) setNumericFieldNullable(row, "purchase_price", updates.purchasePrice);
  if (updates.estimatedValue !== undefined) {
    setNumericFieldNullable(row, "estimated_value", updates.estimatedValue);
    setNumericFieldNullable(row, "value", updates.estimatedValue);
  }
  if (updates.purchaseDate !== undefined) setDateFieldNullable(row, "purchase_date", updates.purchaseDate);
  if (updates.photoUri !== undefined && updates.photoUri) row.photo_url = updates.photoUri;
  if (updates.isSelected !== undefined) row.is_selected = updates.isSelected;

  if (Object.keys(row).length === 0) return;

  await updatePropertyRow(userId, id, row);
}

export async function deleteProperty(userId: string, id: string) {
  const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Best-effort — no-op when is_selected column is not deployed yet. */
export async function clearPropertySelection(userId: string) {
  const { error } = await supabase
    .from("properties")
    .update({ is_selected: false })
    .eq("user_id", userId);

  if (error && !isMissingSchemaError(error.message)) {
    throw new Error(error.message);
  }
}

/** Best-effort — selection still works client-side if column is missing. */
export async function setSelectedProperty(userId: string, id: string) {
  await clearPropertySelection(userId);

  const { error } = await supabase
    .from("properties")
    .update({ is_selected: true })
    .eq("id", id)
    .eq("user_id", userId);

  if (error && !isMissingSchemaError(error.message)) {
    throw new Error(error.message);
  }
}

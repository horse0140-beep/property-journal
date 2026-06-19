import { supabase } from "@/lib/supabase";
import {
  APPLIANCE_OPTIONAL_COLUMNS,
  omitMissingOptionalColumn,
  stripKnownMissingColumns,
} from "@/lib/dbErrors";
import {
  setDateFieldNullable,
  setNumericFieldNullable,
  setTextField,
  toNumericOrNull,
} from "@/lib/dbSanitize";
import type { Appliance } from "@/data/demoData";
import { applianceToRow, rowToAppliance } from "@/types/database";

async function insertApplianceRow(userId: string, item: Appliance): Promise<Appliance> {
  let current = stripKnownMissingColumns(
    applianceToRow(userId, item),
    APPLIANCE_OPTIONAL_COLUMNS
  );

  for (;;) {
    const { data, error } = await supabase.from("appliances").insert(current).select().single();
    if (!error) return rowToAppliance(data);
    const next = omitMissingOptionalColumn(current, error.message, APPLIANCE_OPTIONAL_COLUMNS);
    if (!next) throw new Error(error.message);
    current = next;
  }
}

async function updateApplianceRow(
  userId: string,
  id: string,
  row: Record<string, unknown>
) {
  let current = stripKnownMissingColumns(row, APPLIANCE_OPTIONAL_COLUMNS);

  for (;;) {
    const { error } = await supabase
      .from("appliances")
      .update(current)
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) return;
    const next = omitMissingOptionalColumn(current, error.message, APPLIANCE_OPTIONAL_COLUMNS);
    if (!next) throw new Error(error.message);
    current = next;
  }
}

function buildApplianceUpdateRow(updates: Partial<Appliance>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) row.name = updates.name;
  if (updates.category !== undefined) setTextField(row, "category", updates.category);
  if (updates.brand !== undefined) setTextField(row, "brand", updates.brand);
  if (updates.model !== undefined) setTextField(row, "model", updates.model);

  if (updates.serial !== undefined) {
    setTextField(row, "serial", updates.serial);
    setTextField(row, "serial_number", updates.serial);
  }

  if (updates.installDate !== undefined) {
    setDateFieldNullable(row, "install_date", updates.installDate);
    setDateFieldNullable(row, "purchase_date", updates.installDate);
  }

  if (updates.purchasePrice !== undefined) {
    setNumericFieldNullable(row, "purchase_price", updates.purchasePrice);
  }

  if (updates.expectedLifeYears !== undefined) {
    const lifeYears = toNumericOrNull(updates.expectedLifeYears);
    if (lifeYears !== null) row.expected_life_years = lifeYears;
    else row.expected_life_years = null;
  }

  if (updates.warrantyExpires !== undefined) {
    setDateFieldNullable(row, "warranty_expires", updates.warrantyExpires);
    setDateFieldNullable(row, "warranty_expiration", updates.warrantyExpires);
  }

  if (updates.lastService !== undefined) setTextField(row, "last_service", updates.lastService);
  if (updates.nextService !== undefined) setTextField(row, "next_service", updates.nextService);
  if (updates.condition !== undefined) setTextField(row, "condition", updates.condition);
  if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);

  if (updates.photoUri !== undefined && updates.photoUri) {
    row.photo_url = updates.photoUri;
  }
  if (updates.manualUri !== undefined && updates.manualUri) {
    row.manual_url = updates.manualUri;
  }
  if (updates.receiptUri !== undefined && updates.receiptUri) {
    row.receipt_url = updates.receiptUri;
  }

  return row;
}

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
  return insertApplianceRow(userId, item);
}

export async function updateAppliance(userId: string, id: string, updates: Partial<Appliance>) {
  const row = buildApplianceUpdateRow(updates);
  if (Object.keys(row).length === 0) return;
  await updateApplianceRow(userId, id, row);
}

export async function deleteAppliance(userId: string, id: string) {
  const { error } = await supabase.from("appliances").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

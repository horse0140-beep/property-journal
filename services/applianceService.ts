import { supabase } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/authUser";
import {
  APPLIANCE_OPTIONAL_COLUMNS,
  omitMissingOptionalColumn,
  stripKnownMissingColumns,
} from "@/lib/dbErrors";
import { logSaveErrorFull } from "@/lib/saveLogs";
import { isInsertOkSelectFailed } from "@/lib/realSaveError";
import { fetchInsertedRow, runSaveWithRetry } from "@/lib/saveReliability";
import {
  setNumericFieldNullable,
  setTextField,
  toNumericOrNull,
} from "@/lib/dbSanitize";
import { setIsoDateFieldNullable } from "@/lib/dateForDatabase";
import type { Appliance } from "@/data/demoData";
import { applianceToRow, rowToAppliance } from "@/types/database";

function applianceDisplayName(item: Pick<Appliance, "name">): string {
  return (item.name ?? "").trim();
}

function buildApplianceInsertRow(userId: string, item: Appliance): Record<string, unknown> {
  const displayName = applianceDisplayName(item);
  const row = applianceToRow(userId, { ...item, name: displayName });
  row.appliance_name = displayName;
  row.name = displayName;
  return row;
}

function buildApplianceUpdateRow(updates: Partial<Appliance>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    const displayName = updates.name.trim();
    row.appliance_name = displayName;
    row.name = displayName;
  }
  if (updates.category !== undefined) setTextField(row, "category", updates.category);
  if (updates.brand !== undefined) setTextField(row, "brand", updates.brand);
  if (updates.model !== undefined) setTextField(row, "model", updates.model);
  if (updates.serial !== undefined) setTextField(row, "serial", updates.serial);
  if (updates.installDate !== undefined) setIsoDateFieldNullable(row, "install_date", updates.installDate, "Install date");
  if (updates.purchasePrice !== undefined) setNumericFieldNullable(row, "purchase_price", updates.purchasePrice);
  if (updates.expectedLifeYears !== undefined) row.expected_life_years = toNumericOrNull(updates.expectedLifeYears);
  if (updates.warrantyExpires !== undefined) setIsoDateFieldNullable(row, "warranty_expires", updates.warrantyExpires, "Warranty expires");
  if (updates.lastService !== undefined) setTextField(row, "last_service", updates.lastService);
  if (updates.nextService !== undefined) setTextField(row, "next_service", updates.nextService);
  if (updates.condition !== undefined) setTextField(row, "condition", updates.condition);
  if (updates.notes !== undefined) setTextField(row, "notes", updates.notes);
  if (updates.photoUri !== undefined && updates.photoUri) row.photo_url = updates.photoUri;
  if (updates.manualUri !== undefined && updates.manualUri) row.manual_url = updates.manualUri;
  if (updates.receiptUri !== undefined && updates.receiptUri) row.receipt_url = updates.receiptUri;

  return row;
}

async function insertApplianceRow(
  userId: string,
  item: Appliance
): Promise<Record<string, unknown>> {
  const displayName = applianceDisplayName(item);
  if (!displayName) {
    throw new Error("Appliance name is required.");
  }

  let payload = buildApplianceInsertRow(userId, item);

  for (;;) {
    const { data, error } = await supabase.from("appliances").insert(payload).select().single();

    if (!error) return data!;

    if (isInsertOkSelectFailed(error)) {
      const fetched = await fetchInsertedRow("appliances", item.id, userId);
      if (fetched) return fetched;
      return { ...payload, id: item.id };
    }

    const next = omitMissingOptionalColumn(payload, error.message, APPLIANCE_OPTIONAL_COLUMNS);
    if (next) {
      // Re-apply the display name only to columns that survived the strip —
      // re-adding a stripped column would retry forever.
      if ("appliance_name" in next) next.appliance_name = displayName;
      if ("name" in next) next.name = displayName;
      payload = next;
      continue;
    }

    logSaveErrorFull("appliance", error);
    throw new Error(error.message);
  }
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

export async function createAppliance(_userId: string, item: Appliance): Promise<Appliance> {
  return runSaveWithRetry("appliances", "insert", { id: item.id }, async () => {
    const user = await getAuthenticatedUser();
    const displayName = applianceDisplayName(item);
    if (!displayName) {
      throw new Error("Appliance name is required.");
    }

    const data = await insertApplianceRow(user.id, { ...item, name: displayName });
    return rowToAppliance(data);
  });
}

export async function updateAppliance(userId: string, id: string, updates: Partial<Appliance>) {
  return runSaveWithRetry("appliances", "update", { id, updates }, async () => {
    let row = stripKnownMissingColumns(buildApplianceUpdateRow(updates), APPLIANCE_OPTIONAL_COLUMNS);
    if (Object.keys(row).length === 0) return;

    for (;;) {
      const { data, error } = await supabase
        .from("appliances")
        .update(row)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (!error) return data ?? { id, ...updates };

      if (isInsertOkSelectFailed(error)) {
        const fetched = await fetchInsertedRow("appliances", id, userId);
        if (fetched) return;
      }

      const next = omitMissingOptionalColumn(row, error.message, APPLIANCE_OPTIONAL_COLUMNS);
      if (next && Object.keys(next).length > 0) {
        row = next;
        continue;
      }

      logSaveErrorFull("appliance", error);
      throw new Error(error.message);
    }
  });
}

export async function deleteAppliance(userId: string, id: string) {
  const { error } = await supabase.from("appliances").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

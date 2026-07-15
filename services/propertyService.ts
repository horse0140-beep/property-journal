import { supabase } from "@/lib/supabase";
import {
  ensureAuthProfileRow,
  getAuthenticatedUser,
  logAuthUserIdAudit,
} from "@/lib/authUser";
import { assertNoError } from "@/lib/userErrors";
import { isInsertOkSelectFailed } from "@/lib/realSaveError";
import { fetchInsertedRow, runSaveWithRetry } from "@/lib/saveReliability";
import type { Property } from "@/data/demoData";
import { propertyPartialToRow, propertyToRow, rowToProperty } from "@/types/database";

/** Sole data-access layer for properties (no separate PropertyRepository). */

function throwIfPropertyError(error: { message: string; code?: string; details?: string; hint?: string } | null) {
  if (!error) return;
  console.warn("PROPERTY_INSERT_ERROR_FULL", JSON.stringify(error, null, 2));
  throw new Error(error.message);
}

export async function fetchProperties(): Promise<Property[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("No authenticated user");
  }

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  assertNoError("property_load", error, "property_load");
  return (data ?? []).map((r) => rowToProperty(r));
}

export async function createProperty(property: Property): Promise<Property> {
  return runSaveWithRetry("properties", "insert", { id: property.id }, async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("No authenticated user");
    }

    await ensureAuthProfileRow(user);

    const row = propertyToRow(property);
    delete row.user_id;

    const payload = {
      ...row,
      user_id: user.id,
    };

    logAuthUserIdAudit("createProperty", user.id, String(payload.user_id));

    const { data, error } = await supabase
      .from("properties")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (isInsertOkSelectFailed(error)) {
        const fetched = await fetchInsertedRow("properties", property.id, user.id);
        if (fetched) return rowToProperty(fetched);
      }
      throwIfPropertyError(error);
    }

    return rowToProperty(data!);
  });
}

export async function updateProperty(
  id: string,
  updates: Partial<Property>
): Promise<Property | null> {
  return runSaveWithRetry("properties", "update", { id, updates }, async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("No authenticated user");
    }

    const row = propertyPartialToRow(updates);
    if (Object.keys(row).length === 0) return null;

    const { data, error } = await supabase
      .from("properties")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (isInsertOkSelectFailed(error)) {
        const fetched = await fetchInsertedRow("properties", id, user.id);
        if (fetched) return rowToProperty(fetched);
      }
      throwIfPropertyError(error);
    }

    return rowToProperty(data!);
  });
}

export async function deleteProperty(id: string) {
  const user = await getAuthenticatedUser();
  const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", user.id);
  throwIfPropertyError(error);
}

/**
 * Child tables that reference properties(property_id).
 * Deleted child-first so the property delete cannot be blocked by a
 * foreign key that is missing ON DELETE CASCADE in the live database.
 */
const PROPERTY_CHILD_TABLES = [
  "maintenance_forecasts",
  "property_shares",
  "reports",
  "property_scores",
  "photos",
  "documents",
  "receipts",
  "warranties",
  "maintenance_items",
  "repairs",
  "appliances",
  "paint_colors",
] as const;

/** Ordered, RLS-scoped deletion of a property and all owned child records. */
export async function deletePropertyDeep(id: string): Promise<void> {
  const user = await getAuthenticatedUser();
  console.log("[PROPERTY DELETE] start", { propertyId: id });

  // contractors keep their row — FK is ON DELETE SET NULL by design.
  const { error: contractorError } = await supabase
    .from("contractors")
    .update({ property_id: null })
    .eq("property_id", id)
    .eq("user_id", user.id);
  if (contractorError) {
    console.warn("[PROPERTY DELETE] contractor detach failed:", contractorError.message);
  }

  const childErrors: string[] = [];
  for (const table of PROPERTY_CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq("property_id", id);
    if (error) {
      // Missing table/column in the live schema is fine — nothing to clean up.
      const benign = error.code === "42P01" || error.code === "42703";
      console.warn(`[PROPERTY DELETE] ${table}:`, error.code, error.message);
      if (!benign) childErrors.push(`${table}: ${error.message}`);
    } else {
      console.log(`[PROPERTY DELETE] cleared ${table}`);
    }
  }

  const { error, count } = await supabase
    .from("properties")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.warn("PROPERTY_DELETE_ERROR_FULL", JSON.stringify(error, null, 2));
    const suffix = childErrors.length > 0 ? ` (child record cleanup also failed: ${childErrors.join("; ")})` : "";
    throw new Error(`${error.message}${suffix}`);
  }

  if (!count) {
    throw new Error(
      "Property delete removed no rows. The row may not exist or the RLS DELETE policy on properties blocked it."
    );
  }

  console.log("[PROPERTY DELETE] complete", { propertyId: id, deleted: count });
}

export async function clearPropertySelection() {
  const user = await getAuthenticatedUser();
  const { error } = await supabase
    .from("properties")
    .update({ is_selected: false })
    .eq("user_id", user.id);

  if (error) console.warn("PROPERTY_INSERT_ERROR_FULL", JSON.stringify(error, null, 2));
}

export async function setSelectedProperty(id: string) {
  await clearPropertySelection();
  const user = await getAuthenticatedUser();

  const { error } = await supabase
    .from("properties")
    .update({ is_selected: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) console.warn("PROPERTY_INSERT_ERROR_FULL", JSON.stringify(error, null, 2));
}

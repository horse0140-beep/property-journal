import { supabase } from "@/lib/supabase";
import { omitMissingOptionalColumn } from "@/lib/dbErrors";
import type { EntitlementKey } from "@/types/admin";

const ENTITLEMENT_OPTIONAL_COLUMNS = ["granted_by"] as const;

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("42p01") ||
    lower.includes("could not find the table")
  );
}

/** Upsert user_entitlements; strips granted_by if column missing on live DB. */
export async function upsertUserEntitlement(
  userId: string,
  entitlement: EntitlementKey,
  grantedBy?: string | null
): Promise<void> {
  let payload: Record<string, unknown> = {
    user_id: userId,
    entitlement,
    granted_by: grantedBy ?? null,
  };

  for (;;) {
    const { error } = await supabase.from("user_entitlements").upsert(payload, {
      onConflict: "user_id,entitlement",
    });

    if (!error) return;

    const next = omitMissingOptionalColumn(payload, error.message, ENTITLEMENT_OPTIONAL_COLUMNS);
    if (!next) {
      if (!isMissingTableError(error.message)) {
        throw new Error(error.message);
      }
      return;
    }
    payload = next;
  }
}

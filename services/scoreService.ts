import { supabase } from "@/lib/supabase";
import { isMissingSchemaError, omitMissingOptionalColumn } from "@/lib/dbErrors";
import type { PropertyScore } from "@/context/HomeWiseContext";
import { rowToScore, scoreToRow } from "@/types/database";

const SCORE_OPTIONAL_COLUMNS = ["user_id"] as const;

function rowsToScoreMap(rows: Record<string, unknown>[]): Record<string, PropertyScore> {
  const map: Record<string, PropertyScore> = {};
  for (const row of rows) {
    map[row.property_id as string] = rowToScore(row);
  }
  return map;
}

/** Optional — never throws; returns {} when table/columns are missing or empty. */
export async function fetchPropertyScores(
  userId: string,
  propertyIds: string[] = []
): Promise<Record<string, PropertyScore>> {
  const byUser = await supabase
    .from("property_scores")
    .select("*")
    .eq("user_id", userId);

  if (!byUser.error) {
    return rowsToScoreMap(byUser.data ?? []);
  }

  if (propertyIds.length > 0) {
    const byProperty = await supabase
      .from("property_scores")
      .select("*")
      .in("property_id", propertyIds);

    if (!byProperty.error) {
      return rowsToScoreMap(byProperty.data ?? []);
    }
  }

  if (isMissingSchemaError(byUser.error.message)) {
    console.warn("fetchPropertyScores:", byUser.error.message);
  } else {
    console.warn("fetchPropertyScores:", byUser.error.message);
  }

  return {};
}

/** Best-effort persist — returns the score without throwing on schema/sync errors. */
export async function upsertPropertyScore(
  userId: string,
  propertyId: string,
  score: PropertyScore
): Promise<PropertyScore> {
  let current: Record<string, unknown> = { ...scoreToRow(userId, propertyId, score) };

  for (;;) {
    const result = await supabase
      .from("property_scores")
      .upsert(current, { onConflict: "property_id" })
      .select()
      .single();

    if (!result.error) {
      return rowToScore(result.data);
    }

    const next = omitMissingOptionalColumn(current, result.error.message, SCORE_OPTIONAL_COLUMNS);
    if (!next) {
      console.warn("upsertPropertyScore:", result.error.message);
      return score;
    }

    current = next;
  }
}

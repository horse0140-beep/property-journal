import { supabase } from "@/lib/supabase";
import type { PropertyScore } from "@/context/HomeWiseContext";
import { rowToScore, scoreToRow } from "@/types/database";

export async function fetchPropertyScores(userId: string): Promise<Record<string, PropertyScore>> {
  const { data, error } = await supabase
    .from("property_scores")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const map: Record<string, PropertyScore> = {};
  for (const row of data ?? []) {
    map[row.property_id as string] = rowToScore(row);
  }
  return map;
}

export async function upsertPropertyScore(
  userId: string,
  propertyId: string,
  score: PropertyScore
): Promise<PropertyScore> {
  const { data, error } = await supabase
    .from("property_scores")
    .upsert(scoreToRow(userId, propertyId, score), { onConflict: "property_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToScore(data);
}

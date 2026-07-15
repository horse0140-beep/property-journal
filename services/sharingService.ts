import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { assertNoError, logTechnicalError } from "@/lib/userErrors";
import type { PropertyShare } from "@/types/premium";

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  let token = "HW-";
  for (const byte of bytes) {
    token += chars[byte % chars.length];
  }
  return token;
}

export type PropertyShareInput = {
  property_id: string;
  property_label: string;
  label: string;
  expires_at?: string | null;
  include_personal_info: boolean;
  snapshot_json?: Record<string, unknown>;
};

export async function fetchPropertyShares(userId: string): Promise<PropertyShare[]> {
  const { data, error } = await supabase
    .from("property_shares")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    logTechnicalError("fetchPropertyShares", error);
    assertNoError("sharing", error, "sharing");
  }
  return (data ?? []) as PropertyShare[];
}

export async function fetchPropertyShareByToken(token: string): Promise<PropertyShare | null> {
  // Security definer RPC (migration 026): the token-less public SELECT policy
  // was removed, so viewers can only fetch the single share for a known token.
  // The RPC also handles active/expiry checks and increments views_count.
  const { data, error } = await supabase.rpc("get_share_by_token", { p_token: token });

  if (error) {
    logTechnicalError("fetchPropertyShareByToken", error);
    return null;
  }

  if (!data) return null;
  return data as PropertyShare;
}

export async function createPropertyShare(
  userId: string,
  input: PropertyShareInput
): Promise<PropertyShare> {
  const { data, error } = await supabase
    .from("property_shares")
    .insert({
      user_id: userId,
      property_id: input.property_id,
      property_label: input.property_label,
      label: input.label,
      share_token: generateToken(),
      expires_at: input.expires_at ?? null,
      include_personal_info: input.include_personal_info,
      snapshot_json: input.snapshot_json ?? null,
      is_active: true,
    })
    .select()
    .single();

  assertNoError("sharing_create", error, "sharing_create");
  return data as PropertyShare;
}

export async function updatePropertyShare(
  id: string,
  input: Partial<PropertyShareInput> & { is_active?: boolean }
): Promise<PropertyShare> {
  const { data, error } = await supabase
    .from("property_shares")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  assertNoError("sharing", error, "sharing");
  return data as PropertyShare;
}

export async function revokePropertyShare(id: string): Promise<PropertyShare> {
  return updatePropertyShare(id, { is_active: false });
}

export async function deletePropertyShare(id: string) {
  const { error } = await supabase.from("property_shares").delete().eq("id", id);
  assertNoError("sharing_revoke", error, "sharing_revoke");
}

export function buildShareUrl(token: string): string {
  const base = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? "https://homewise.app/share";
  return `${base}/${token}`;
}

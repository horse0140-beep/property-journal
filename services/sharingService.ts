import { supabase } from "@/lib/supabase";
import { assertNoError, logTechnicalError } from "@/lib/userErrors";
import { shareAudit, shareAuditFailure, maskToken } from "@/lib/shareAudit";
import type { PropertyShare } from "@/types/premium";
import * as Crypto from "expo-crypto";

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
  const trimmed = token?.trim();
  if (!trimmed) return null;

  shareAudit("14", { action: "RPC request started", token: trimmed, rpc: "get_share_by_token", param: "p_token" });

  const { data, error } = await supabase.rpc("get_share_by_token", { p_token: trimmed });

  if (error) {
    shareAuditFailure("15 RPC response", error, {
      token: trimmed,
      rpc: "get_share_by_token",
    });
    logTechnicalError("fetchPropertyShareByToken", error);
    return null;
  }

  if (!data) {
    shareAudit("15", {
      rpcResult: "null",
      token: trimmed,
      meaning: "inactive_expired_or_missing",
    });
    return null;
  }

  // PostgREST may return jsonb as an object or (rarely) a JSON string.
  const row = (typeof data === "string" ? JSON.parse(data) : data) as PropertyShare | null;
  if (!row || typeof row !== "object") {
    shareAudit("15", { rpcResult: "invalid_shape", token: trimmed });
    return null;
  }
  if (!row.share_token || row.is_active === false) {
    shareAudit("15", {
      rpcResult: "inactive_or_missing_token_field",
      token: trimmed,
      isActive: row.is_active ?? null,
    });
    return null;
  }

  shareAudit("15", {
    rpcResult: "ok",
    token: row.share_token,
    shareRecordId: row.id,
    isActive: row.is_active,
    expirationValue: row.expires_at ?? null,
    propertyLabelPresent: Boolean(row.property_label),
    maskedToken: maskToken(row.share_token),
  });
  return row;
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

// URL helpers live in lib/shareUrl.ts (single source of truth).
export { buildShareUrl, buildShareMessage, isShareConfigured, SHARE_NOT_CONFIGURED_MESSAGE } from "@/lib/shareUrl";

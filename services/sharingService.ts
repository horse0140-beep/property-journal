import { supabase } from "@/lib/supabase";
import type { PropertyShare } from "@/types/premium";

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "HW-";
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
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

  if (error) throw new Error(error.message);
  return (data ?? []) as PropertyShare[];
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

  if (error) throw new Error(error.message);
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

  if (error) throw new Error(error.message);
  return data as PropertyShare;
}

export async function deletePropertyShare(id: string) {
  const { error } = await supabase.from("property_shares").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function buildShareUrl(token: string): string {
  const base = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? "https://homewise.app/share";
  return `${base}/${token}`;
}

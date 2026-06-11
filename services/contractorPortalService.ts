import { supabase } from "@/lib/supabase";
import type { ContractorPortalAccess } from "@/types/premium";

function generateAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export type ContractorPortalInput = {
  property_id: string;
  property_label: string;
  contractor_name: string;
  contractor_email: string;
  contractor_phone?: string;
  trade: string;
  permissions: string[];
  notes?: string;
  is_active?: boolean;
};

export async function fetchContractorAccess(userId: string): Promise<ContractorPortalAccess[]> {
  const { data, error } = await supabase
    .from("contractor_portal_access")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContractorPortalAccess[];
}

export async function createContractorAccess(
  userId: string,
  input: ContractorPortalInput
): Promise<ContractorPortalAccess> {
  const { data, error } = await supabase
    .from("contractor_portal_access")
    .insert({
      user_id: userId,
      ...input,
      access_code: generateAccessCode(),
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ContractorPortalAccess;
}

export async function updateContractorAccess(
  id: string,
  input: Partial<ContractorPortalInput>
): Promise<ContractorPortalAccess> {
  const { data, error } = await supabase
    .from("contractor_portal_access")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ContractorPortalAccess;
}

export async function deleteContractorAccess(id: string) {
  const { error } = await supabase.from("contractor_portal_access").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function buildPortalUrl(code: string): string {
  const base = process.env.EXPO_PUBLIC_CONTRACTOR_PORTAL_URL ?? "https://homewise.app/contractor";
  return `${base}?code=${code}`;
}

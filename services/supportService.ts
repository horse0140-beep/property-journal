import { supabase } from "@/lib/supabase";
import type { SupportTicket, TicketPriority, TicketStatus } from "@/types/admin";

export type SupportTicketInput = {
  user_id?: string | null;
  user_email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  admin_notes?: string | null;
};

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SupportTicket[];
}

export async function createSupportTicket(input: SupportTicketInput): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from("support_tickets")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SupportTicket;
}

export async function updateSupportTicket(
  id: string,
  input: Partial<SupportTicketInput>
): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from("support_tickets")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SupportTicket;
}

export async function deleteSupportTicket(id: string) {
  const { error } = await supabase.from("support_tickets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

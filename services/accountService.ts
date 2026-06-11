import { supabase } from "@/lib/supabase";

const USER_DATA_TABLES = [
  "property_shares",
  "contractor_portal_access",
  "maintenance_forecasts",
  "stripe_customers",
  "property_scores",
  "photos",
  "paint_colors",
  "contractors",
  "warranties",
  "receipts",
  "documents",
  "appliances",
  "repairs",
  "maintenance_items",
  "properties",
  "subscriptions",
  "push_tokens",
  "user_roles",
] as const;

async function deleteSupportTickets(userId: string, email: string) {
  const { error: byUserError } = await supabase
    .from("support_tickets")
    .delete()
    .eq("user_id", userId);

  if (byUserError && !byUserError.message.includes("does not exist")) {
    console.warn("deleteSupportTickets by user_id:", byUserError.message);
  }

  const { error: byEmailError } = await supabase
    .from("support_tickets")
    .delete()
    .eq("user_email", email);

  if (byEmailError && !byEmailError.message.includes("does not exist")) {
    console.warn("deleteSupportTickets by email:", byEmailError.message);
  }
}

/** Delete all app data owned by the user. */
export async function deleteUserData(userId: string, email: string): Promise<void> {
  await deleteSupportTickets(userId, email);

  for (const table of USER_DATA_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error && !error.message.includes("does not exist")) {
      console.warn(`deleteUserData ${table}:`, error.message);
    }
  }

  const { error: profileError } = await supabase.from("profiles").delete().eq("id", userId);
  if (profileError) {
    throw new Error(profileError.message);
  }
}

/**
 * Self-service account deletion.
 * 1. Deletes all user-owned records + profile
 * 2. Deletes Supabase auth user via RPC (requires migration 005)
 */
export async function deleteOwnAccount(): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email) {
    throw new Error("You must be signed in to delete your account.");
  }

  await deleteUserData(userId, email);

  const { error: rpcError } = await supabase.rpc("delete_own_account");

  if (rpcError) {
    await supabase.auth.signOut();
    throw new Error(
      rpcError.message.includes("does not exist")
        ? "Account data was removed but auth deletion failed. Please run migration 005 in Supabase."
        : rpcError.message
    );
  }

  await supabase.auth.signOut();
}

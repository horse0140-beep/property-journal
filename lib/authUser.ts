import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isOwnerAdminEmail, FOUNDER_PLAN } from "@/lib/admin";

export class AuthRequiredError extends Error {
  constructor(message = "Please sign in again.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Single source of truth for the authenticated user id.
 * Always call supabase.auth.getUser() — never profile.id or getSession().user.
 */
export async function getAuthenticatedUser(): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthRequiredError("No authenticated user");
  }

  return user;
}

export async function requireAuthUserId(): Promise<string> {
  const user = await getAuthenticatedUser();
  return user.id;
}

/** Temporary production diagnostics for property / push FK debugging. */
export function logAuthUserIdAudit(context: string, authUserId: string, insertedUserId: string): void {
  console.warn(`[${context}] Authenticated user: ${authUserId}`);
  console.warn(`[${context}] Inserted user_id: ${insertedUserId}`);
  if (authUserId !== insertedUserId) {
    console.error(`[${context}] USER_ID MISMATCH auth=${authUserId} insert=${insertedUserId}`);
  }
}

function profileRowFromAuthUser(authUser: User) {
  const meta = authUser.user_metadata ?? {};
  const email = authUser.email ?? "";
  const owner = isOwnerAdminEmail(email);

  return {
    id: authUser.id,
    email,
    name: (meta.name as string) ?? email.split("@")[0] ?? "HomeWise User",
    phone: (meta.phone as string) ?? null,
    avatar_uri: (meta.avatar_uri as string) ?? null,
    plan: owner ? FOUNDER_PLAN : "free",
    notifications_enabled: true,
    maintenance_reminders: true,
    warranty_alerts: true,
    appliance_reminders: true,
    subscription_reminders: true,
    admin_broadcasts: true,
    email_digest: false,
    updated_at: new Date().toISOString(),
  };
}

/** Ensures public.profiles.id = auth.users.id (required before FK writes). */
export async function ensureAuthProfileRow(authUser: User): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    // A transient select failure must not block auth — attempt the upsert anyway.
    console.warn(`[auth] profile check failed (continuing to upsert): ${error.message}`);
  }

  if (data?.id === authUser.id) {
    return;
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(profileRowFromAuthUser(authUser), { onConflict: "id" });

  if (upsertError) {
    throw new Error(`Failed to bootstrap profile: ${upsertError.message}`);
  }

  console.warn(`[auth] ensureAuthProfileRow ok id=${authUser.id}`);
}

export async function requireAuthUserWithProfile(): Promise<User> {
  const user = await getAuthenticatedUser();
  await ensureAuthProfileRow(user);
  return user;
}

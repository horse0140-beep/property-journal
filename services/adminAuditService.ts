import { supabase } from "@/lib/supabase";

export type AdminAuditAction =
  | "grant_plan"
  | "grant_owner"
  | "grant_role"
  | "revoke_access"
  | "revoke_role"
  | "revoke_entitlement"
  | "update_plan"
  | "update_role"
  | "delete_user"
  | "delete_user_blocked"
  | "revoke_blocked";

type LogParams = {
  targetUserId: string;
  targetEmail: string;
  action: AdminAuditAction;
  metadata?: Record<string, unknown>;
};

async function getActor(): Promise<{ id: string | null; email: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    id: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
  };
}

export async function logAdminAction(params: LogParams): Promise<void> {
  const actor = await getActor();

  const { error } = await supabase.from("admin_actions").insert({
    actor_user_id: actor.id,
    actor_email: actor.email,
    target_user_id: params.targetUserId,
    target_email: params.targetEmail,
    action: params.action,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.warn("admin_actions log failed:", error.message);
  }
}

import { supabase } from "@/lib/supabase";
import type { AdminStats, AdminUser, UserRole } from "@/types/admin";

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, phone, plan, created_at")
    .order("created_at", { ascending: false });

  if (profileError) throw new Error(profileError.message);

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("id, user_id, role");

  if (roleError) throw new Error(roleError.message);

  const roleMap = new Map(
    (roles ?? []).map((r) => [r.user_id, { role: r.role as UserRole, role_id: r.id }])
  );

  return (profiles ?? []).map((p) => {
    const roleEntry = roleMap.get(p.id);
    return {
      id: p.id,
      email: p.email,
      name: p.name ?? "HomeWise User",
      phone: p.phone,
      plan: p.plan ?? "free",
      created_at: p.created_at,
      role: roleEntry?.role ?? null,
      role_id: roleEntry?.role_id ?? null,
    };
  });
}

export async function updateUserPlan(userId: string, plan: string) {
  const { error } = await supabase.from("profiles").update({ plan }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function setUserRole(userId: string, role: UserRole) {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}

export async function removeUserRole(userId: string) {
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteUser(userId: string) {
  const { error: roleError } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (roleError) throw new Error(roleError.message);

  const { error: subError } = await supabase.from("subscriptions").delete().eq("user_id", userId);
  if (subError) throw new Error(subError.message);

  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const [usersRes, subsRes, ticketsRes, promosRes, plansRes] = await Promise.all([
    supabase.from("profiles").select("id, plan", { count: "exact" }),
    supabase.from("subscriptions").select("amount, status"),
    supabase.from("support_tickets").select("id", { count: "exact" }).eq("status", "open"),
    supabase.from("promo_codes").select("id", { count: "exact" }).eq("is_active", true),
    supabase.from("profiles").select("plan"),
  ]);

  const usersByPlan = { free: 0, premium: 0, landlord: 0, realtor: 0 };
  for (const row of plansRes.data ?? []) {
    const key = (row.plan ?? "free") as keyof typeof usersByPlan;
    if (key in usersByPlan) usersByPlan[key]++;
  }

  const activeSubscriptions = (subsRes.data ?? []).filter((s) => s.status === "active").length;
  const totalRevenue = (subsRes.data ?? [])
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

  return {
    totalUsers: usersRes.count ?? 0,
    activeSubscriptions,
    openTickets: ticketsRes.count ?? 0,
    activePromoCodes: promosRes.count ?? 0,
    totalRevenue,
    usersByPlan,
  };
}

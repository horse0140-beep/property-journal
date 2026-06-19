import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { deleteOwnAccount } from "@/services/accountService";
import { logOutRevenueCat } from "@/services/revenueCatService";
import { ensureOwnerAdminRole } from "@/services/adminService";
import {
  isOwnerAdminEmail,
  resolveIsAdmin,
  SUPER_ADMIN_ROLE,
} from "@/lib/admin";

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatarUri?: string;
  plan: "free" | "premium" | "landlord" | "realtor";
  /** True for owner email — display as Owner Access regardless of profiles.plan */
  ownerAccess?: boolean;
  createdAt: string;
  notificationsEnabled: boolean;
  maintenanceReminders: boolean;
  warrantyAlerts: boolean;
  applianceReminders: boolean;
  subscriptionReminders: boolean;
  adminBroadcasts: boolean;
  emailDigest: boolean;
};

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  full_name?: string | null;
  phone: string | null;
  avatar_uri: string | null;
  plan: UserProfile["plan"] | null;
  created_at: string;
  notifications_enabled: boolean | null;
  maintenance_reminders: boolean | null;
  warranty_alerts: boolean | null;
  appliance_reminders: boolean | null;
  subscription_reminders: boolean | null;
  admin_broadcasts: boolean | null;
  email_digest: boolean | null;
};

type UserRoleRow = {
  role: string;
};

type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: UserProfile | null;
  /** From user_roles.role — never from profiles. */
  role: string | null;
  isAdmin: boolean;
  isOwner: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<{ error?: string }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>;
  updatePassword: (current: string, next: string) => Promise<{ error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: string }>;
  updatePasswordFromRecovery: (password: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapProfileRow(row: ProfileRow, email?: string): UserProfile {
  const resolvedEmail = email ?? row.email;
  const owner = isOwnerAdminEmail(resolvedEmail);
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.full_name ?? "HomeWise User",
    phone: row.phone ?? "",
    avatarUri: row.avatar_uri ?? undefined,
    plan: row.plan ?? "free",
    ownerAccess: owner,
    createdAt: row.created_at,
    notificationsEnabled: row.notifications_enabled ?? true,
    maintenanceReminders: row.maintenance_reminders ?? true,
    warrantyAlerts: row.warranty_alerts ?? true,
    applianceReminders: row.appliance_reminders ?? true,
    subscriptionReminders: row.subscription_reminders ?? true,
    adminBroadcasts: row.admin_broadcasts ?? true,
    emailDigest: row.email_digest ?? false,
  };
}

function profileFromAuthUser(authUser: User): UserProfile {
  const meta = authUser.user_metadata ?? {};
  const email = authUser.email ?? "";
  const owner = isOwnerAdminEmail(email);

  return {
    id: authUser.id,
    email,
    name: (meta.name as string) ?? authUser.email?.split("@")[0] ?? "HomeWise User",
    phone: (meta.phone as string) ?? "",
    avatarUri: meta.avatar_uri as string | undefined,
    plan: "free",
    ownerAccess: owner,
    createdAt: authUser.created_at ?? new Date().toISOString(),
    notificationsEnabled: true,
    maintenanceReminders: true,
    warrantyAlerts: true,
    applianceReminders: true,
    subscriptionReminders: true,
    adminBroadcasts: true,
    emailDigest: false,
  };
}

function profileToRow(profile: UserProfile) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone || null,
    avatar_uri: profile.avatarUri ?? null,
    plan: profile.plan,
    notifications_enabled: profile.notificationsEnabled,
    maintenance_reminders: profile.maintenanceReminders,
    warranty_alerts: profile.warrantyAlerts,
    appliance_reminders: profile.applianceReminders,
    subscription_reminders: profile.subscriptionReminders,
    admin_broadcasts: profile.adminBroadcasts,
    email_digest: profile.emailDigest,
    updated_at: new Date().toISOString(),
  };
}

function authErrorMessage(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (lower.includes("user already registered")) {
    return "An account with this email already exists.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  return message;
}

async function ensureProfileExists(authUser: User): Promise<UserProfile> {
  const fallbackProfile = profileFromAuthUser(authUser);

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    console.warn("Failed to check profile:", error.message);
  }

  if (data) {
    return mapProfileRow(data as ProfileRow, authUser.email ?? undefined);
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(profileToRow(fallbackProfile), { onConflict: "id" });

  if (upsertError) {
    console.warn("Failed to create profile:", upsertError.message);
  }

  return fallbackProfile;
}

async function fetchUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch user_roles:", error.message);
    return null;
  }

  return (data as UserRoleRow | null)?.role ?? null;
}

async function fetchProfileAndRole(userId: string, authUser: User) {
  const email = authUser.email ?? "";
  const isOwner = isOwnerAdminEmail(email);

  if (isOwner) {
    await ensureOwnerAdminRole(userId, email);
  }

  const [profile, userRole] = await Promise.all([
    ensureProfileExists(authUser),
    fetchUserRole(userId),
  ]);

  const isAdmin = resolveIsAdmin(email, userRole);

  return {
    profile,
    role: isAdmin ? userRole ?? SUPER_ADMIN_ROLE : userRole,
    isAdmin,
    isOwner,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoaded: false,
    isSignedIn: false,
    user: null,
    role: null,
    isAdmin: false,
    isOwner: false,
  });

  const userRef = useRef<UserProfile | null>(null);
  userRef.current = state.user;

  const applySession = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setState({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        role: null,
        isAdmin: false,
        isOwner: false,
      });
      return;
    }

    const email = authUser.email ?? "";
    const isOwner = isOwnerAdminEmail(email);

    // Owner: unlock immediately before user_roles fetch completes
    if (isOwner) {
      setState({
        isLoaded: true,
        isSignedIn: true,
        user: profileFromAuthUser(authUser),
        role: SUPER_ADMIN_ROLE,
        isAdmin: true,
        isOwner: true,
      });
    }

    const { profile, role, isAdmin, isOwner: ownerFlag } = await fetchProfileAndRole(
      authUser.id,
      authUser
    );

    setState({
      isLoaded: true,
      isSignedIn: true,
      user: profile,
      role,
      isAdmin,
      isOwner: ownerFlag,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      if (session?.user) {
        applySession(session.user);
      } else {
        setState((s) => ({ ...s, isLoaded: true }));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      applySession(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      return { error: authErrorMessage(error.message) };
    }

    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const normalizedEmail = email.toLowerCase().trim();

    if (password.length < 8) {
      return { error: "Password must be at least 8 characters." };
    }

    if (!normalizedEmail.includes("@")) {
      return { error: "Please enter a valid email address." };
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name: name.trim() },
      },
    });

    if (error) {
      return { error: authErrorMessage(error.message) };
    }

    if (!data.user) {
      return { error: "Sign up failed. Please try again." };
    }

    if (!data.session) {
      return {
        error:
          "Please check your email and confirm your account before signing in.",
      };
    }

    const profile: UserProfile = {
      id: data.user.id,
      email: normalizedEmail,
      name: name.trim(),
      phone: "",
      plan: "free",
      createdAt: data.user.created_at ?? new Date().toISOString(),
      notificationsEnabled: true,
      maintenanceReminders: true,
      warrantyAlerts: true,
      applianceReminders: true,
      subscriptionReminders: true,
      adminBroadcasts: true,
      emailDigest: false,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileToRow(profile), { onConflict: "id" });

    if (profileError) {
      return { error: profileError.message };
    }

    if (isOwnerAdminEmail(normalizedEmail)) {
      await ensureOwnerAdminRole(data.user.id, normalizedEmail);
    }

    return {};
  }, []);

  const signOut = useCallback(async () => {
    await logOutRevenueCat().catch(() => {});
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: authErrorMessage(error.message) };
    }
    return {};
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const current = userRef.current;

    if (!current) {
      return { error: "Not signed in." };
    }

    const updated: UserProfile = {
      ...current,
      ...updates,
      name: updates.name ?? current.name,
      phone: updates.phone ?? current.phone,
    };

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        name: updated.name,
        phone: updated.phone,
        avatar_uri: updated.avatarUri ?? null,
      },
    });

    if (authUpdateError) {
      return { error: authErrorMessage(authUpdateError.message) };
    }

    const row = {
      name: updated.name,
      phone: updated.phone || null,
      avatar_uri: updated.avatarUri ?? null,
      plan: updated.plan,
      notifications_enabled: updated.notificationsEnabled,
      maintenance_reminders: updated.maintenanceReminders,
      warranty_alerts: updated.warrantyAlerts,
      appliance_reminders: updated.applianceReminders,
      subscription_reminders: updated.subscriptionReminders,
      admin_broadcasts: updated.adminBroadcasts,
      email_digest: updated.emailDigest,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: updated.id, email: updated.email, ...row }, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    const saved = data
      ? mapProfileRow(data as ProfileRow, current.email)
      : { ...updated, ownerAccess: isOwnerAdminEmail(current.email) };
    setState((s) => ({ ...s, user: saved }));
    return {};
  }, []);

  const updatePassword = useCallback(async (current: string, next: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return { error: "Not signed in." };

    if (next.length < 8) {
      return { error: "New password must be at least 8 characters." };
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: current,
    });

    if (verifyError) {
      return { error: "Current password is incorrect." };
    }

    const { error } = await supabase.auth.updateUser({ password: next });

    if (error) {
      return { error: authErrorMessage(error.message) };
    }

    return {};
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const normalized = email.toLowerCase().trim();

    if (!normalized.includes("@")) {
      return { error: "Please enter a valid email address." };
    }

    const redirectTo = "homewise://auth/reset-password";

    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo,
    });

    if (error) {
      return { error: authErrorMessage(error.message) };
    }

    return {};
  }, []);

  const updatePasswordFromRecovery = useCallback(async (password: string) => {
    if (password.length < 8) {
      return { error: "Password must be at least 8 characters." };
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: authErrorMessage(error.message) };
    }

    return {};
  }, []);

  const deleteAccount = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return { error: "Not signed in." };

    try {
      await deleteOwnAccount();
      return {};
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Failed to delete account." };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      updateProfile,
      updatePassword,
      resetPasswordForEmail,
      updatePasswordFromRecovery,
      deleteAccount,
    }),
    [
      state,
      signIn,
      signUp,
      signOut,
      updateProfile,
      updatePassword,
      resetPasswordForEmail,
      updatePasswordFromRecovery,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be inside AuthProvider");
  }

  return ctx;
}

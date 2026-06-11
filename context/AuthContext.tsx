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

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatarUri?: string;
  plan: "free" | "premium" | "landlord" | "realtor";
  createdAt: string;
  notificationsEnabled: boolean;
  maintenanceReminders: boolean;
  warrantyAlerts: boolean;
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
  email_digest: boolean | null;
};

type UserRoleRow = {
  role: string;
};

type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: UserProfile | null;
  role: string | null;
  isAdmin: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>;
  updatePassword: (current: string, next: string) => Promise<{ error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: string }>;
  updatePasswordFromRecovery: (password: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.full_name ?? "HomeWise User",
    phone: row.phone ?? "",
    avatarUri: row.avatar_uri ?? undefined,
    plan: row.plan ?? "free",
    createdAt: row.created_at,
    notificationsEnabled: row.notifications_enabled ?? true,
    maintenanceReminders: row.maintenance_reminders ?? true,
    warrantyAlerts: row.warranty_alerts ?? true,
    emailDigest: row.email_digest ?? false,
  };
}

function profileFromAuthUser(authUser: User): UserProfile {
  const meta = authUser.user_metadata ?? {};

  return {
    id: authUser.id,
    email: authUser.email ?? "",
    name: (meta.name as string) ?? authUser.email?.split("@")[0] ?? "HomeWise User",
    phone: (meta.phone as string) ?? "",
    avatarUri: meta.avatar_uri as string | undefined,
    plan: "free",
    createdAt: authUser.created_at ?? new Date().toISOString(),
    notificationsEnabled: true,
    maintenanceReminders: true,
    warrantyAlerts: true,
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
    return mapProfileRow(data as ProfileRow);
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(profileToRow(fallbackProfile), { onConflict: "id" });

  if (upsertError) {
    console.warn("Failed to create profile:", upsertError.message);
  }

  return fallbackProfile;
}

async function fetchProfileAndRole(userId: string, authUser: User) {
  const [profile, roleResult] = await Promise.all([
    ensureProfileExists(authUser),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);

  if (roleResult.error) {
    console.warn("Failed to fetch role:", roleResult.error.message);
  }

  const role = (roleResult.data as UserRoleRow | null)?.role ?? null;

  return {
    profile,
    role,
    isAdmin: role === "super_admin",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoaded: false,
    isSignedIn: false,
    user: null,
    role: null,
    isAdmin: false,
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
      });
      return;
    }

    const { profile, role, isAdmin } = await fetchProfileAndRole(authUser.id, authUser);

    setState({
      isLoaded: true,
      isSignedIn: true,
      user: profile,
      role,
      isAdmin,
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
      emailDigest: false,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileToRow(profile), { onConflict: "id" });

    if (profileError) {
      return { error: profileError.message };
    }

    return {};
  }, []);

  const signOut = useCallback(async () => {
    await logOutRevenueCat().catch(() => {});
    await supabase.auth.signOut();
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

    const { data, error } = await supabase
      .from("profiles")
      .update({
        name: updated.name,
        phone: updated.phone || null,
        avatar_uri: updated.avatarUri ?? null,
        plan: updated.plan,
        notifications_enabled: updated.notificationsEnabled,
        maintenance_reminders: updated.maintenanceReminders,
        warranty_alerts: updated.warrantyAlerts,
        email_digest: updated.emailDigest,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updated.id)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    const saved = data ? mapProfileRow(data as ProfileRow) : updated;
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

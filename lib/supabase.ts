import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}) as Record<
  string,
  string | undefined
>;

const supabaseUrl = normalizeSupabaseUrl(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? ""
);
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env or EAS secrets."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);

// Supabase's recommended React Native pattern: only refresh tokens while the
// app is foregrounded, and refresh immediately on resume so requests after a
// long background period don't hit an expired access token.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

/** Must match app.json → expo.scheme */
export const APP_SCHEME = "homewise";

/** Primary auth deep-link path (Supabase emailRedirectTo target). */
export const AUTH_CALLBACK_PATH = "auth/callback";

export type AuthRedirectPath = typeof AUTH_CALLBACK_PATH | "auth/reset-password";

function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * Builds the redirect URL Supabase should use after email confirm / password reset.
 *
 * - Expo Go (dev): exp://…/--/auth/callback via Linking.createURL
 * - Native build: homewise://auth/callback (explicit scheme — never homewise.app)
 * - Web dev: http://localhost:8081/auth/callback
 *
 * Override with EXPO_PUBLIC_AUTH_REDIRECT_URL when you need a fixed URL.
 */
export function getAuthRedirectUrl(path: AuthRedirectPath = AUTH_CALLBACK_PATH): string {
  const override = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (override) {
    return override;
  }

  if (Platform.OS === "web") {
    return Linking.createURL(path);
  }

  // Expo Go cannot open homewise:// — use the dev-server exp:// URL.
  if (isExpoGo()) {
    return Linking.createURL(path);
  }

  return `${APP_SCHEME}://${path}`;
}

export function getConfirmEmailRedirectUrl(): string {
  return getAuthRedirectUrl(AUTH_CALLBACK_PATH);
}

export function getResetPasswordRedirectUrl(): string {
  return getAuthRedirectUrl("auth/reset-password");
}

/** Logged in dev so you can verify Supabase allow-list matches. */
export function logAuthRedirectUrl(label: string, url: string): void {
  if (__DEV__) {
    console.info(`[auth] ${label}: ${url}`);
  }
}

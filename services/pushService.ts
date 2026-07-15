import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { supportsRemotePush } from "@/lib/expoRuntime";
import { ensureAuthProfileRow, logAuthUserIdAudit } from "@/lib/authUser";

export async function registerPushToken(): Promise<string | null> {
  if (!supportsRemotePush()) {
    return null;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    let projectId: string | undefined;
    try {
      const Constants = require("expo-constants").default;
      projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    } catch {
      projectId = undefined;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;
    const platform = Platform.OS as "ios" | "android";

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    await ensureAuthProfileRow(user);

    const insertedUserId = user.id;
    logAuthUserIdAudit("registerPushToken", user.id, insertedUserId);

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: insertedUserId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );

    if (error) {
      console.warn("Failed to save push token:", error.message);
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Re-register when the OS rotates the push token. No-op in Expo Go.
 */
export function subscribePushTokenChanges(): () => void {
  if (!supportsRemotePush()) {
    return () => {};
  }

  try {
    const subscription = Notifications.addPushTokenListener(() => {
      void registerPushToken();
    });
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}

export async function unregisterPushTokens(): Promise<void> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return;

    await supabase.from("push_tokens").delete().eq("user_id", user.id);
  } catch {
    // Non-fatal — sign-out and account deletion must continue.
  }
}

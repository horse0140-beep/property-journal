import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";

export async function registerPushToken(userId: string): Promise<string | null> {
  if (Platform.OS === "web") return null;

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

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
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
}

export async function unregisterPushTokens(userId: string): Promise<void> {
  await supabase.from("push_tokens").delete().eq("user_id", userId);
}

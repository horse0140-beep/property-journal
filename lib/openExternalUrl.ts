import { Linking, Platform } from "react-native";

/**
 * Open a remote file/URL. On Android, Linking.canOpenURL(https) often returns
 * false due to package visibility — do not treat that as "cannot open".
 */
export async function openExternalUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("No URL to open.");

  if (Platform.OS === "android" && /^https?:\/\//i.test(trimmed)) {
    await Linking.openURL(trimmed);
    return;
  }

  const supported = await Linking.canOpenURL(trimmed);
  if (!supported) {
    throw new Error("This file cannot be opened on this device.");
  }
  await Linking.openURL(trimmed);
}

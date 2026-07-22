import { Alert, Platform } from "react-native";

/** Visible feedback that works on web (RN Alert.alert is a no-op on react-native-web). */
export function notifyUser(title: string, message?: string): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Destructive confirm that works on web and native.
 * RN Alert.alert confirm buttons never fire on react-native-web.
 */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel = "Delete"
): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: "destructive",
        onPress: () => resolve(true),
      },
    ]);
  });
}

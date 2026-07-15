import Constants from "expo-constants";
import { Platform } from "react-native";

/** True when running inside the Expo Go client (not a dev/production native build). */
export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/** Remote push tokens / FCM — dev and production native builds only. */
export function supportsRemotePush(): boolean {
  return Platform.OS !== "web" && !isExpoGo();
}

/** Local scheduled notifications — safe in Expo Go and native builds. */
export function supportsLocalNotifications(): boolean {
  return Platform.OS !== "web";
}

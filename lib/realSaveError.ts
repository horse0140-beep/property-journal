import { Alert } from "react-native";
import Constants from "expo-constants";
import { friendlyMessage } from "@/lib/userErrors";
import { AuthRequiredError } from "@/lib/authUser";

export function logSaveSuccessEvent(screen: string, action: string, saved: unknown) {
  console.log("SAVE_SUCCESS", { screen, action, saved });
}

/** Preview / RC builds must surface the real error — not the generic friendly string. */
function shouldShowRealSaveErrors(): boolean {
  if (__DEV__) return true;
  if (process.env.EXPO_PUBLIC_SHOW_REAL_ERRORS === "1") return true;
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (extra?.showRealErrors === true || extra?.showRealErrors === "1") return true;
  return false;
}

const SCREEN_MESSAGE_KEY: Record<string, string> = {
  maintenance: "maintenance",
  properties: "property",
  property: "generic",
  vault: "document",
  photos: "photo",
  upload: "document",
  HomeWiseContext: "generic",
  appliance: "appliance",
  repair: "repair",
  paint: "paint",
  contractor: "contractor",
};

function formatDevSaveError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function showRealSaveError(screen: string, action: string, error: unknown) {
  if (error instanceof AuthRequiredError || (error instanceof Error && error.message === "No authenticated user")) {
    Alert.alert("Session expired", "Please sign in again.");
    return;
  }

  const message = formatDevSaveError(error);

  console.warn("[SAVE FAILED]", {
    screen,
    action,
    message,
    error,
  });

  if (shouldShowRealSaveErrors()) {
    Alert.alert("Save Failed", `[${screen}] ${action}\n\n${message}`);
    return;
  }

  const key = SCREEN_MESSAGE_KEY[screen] ?? "generic";
  Alert.alert("Save Failed", friendlyMessage(key));
}

/** PostgREST .single() returns this when insert/update succeeded but SELECT returned 0 rows. */
export function isInsertOkSelectFailed(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST116" ||
    msg.includes("0 rows") ||
    msg.includes("no rows") ||
    msg.includes("cannot coerce the result to a single json object") ||
    msg.includes("json object requested") ||
    msg.includes("multiple (or no) rows returned")
  );
}

export function throwUnlessInsertOkSelectFailed(
  type: string,
  error: { message: string; code?: string } | null
): void {
  if (!error) return;
  if (isInsertOkSelectFailed(error)) {
    console.warn("INSERT_OK_SELECT_FAILED", { type, error });
    return;
  }
  throw new Error(error.message);
}

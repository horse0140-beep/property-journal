import NetInfo from "@react-native-community/netinfo";

export function isLikelyNetworkError(error: unknown): boolean {
  const msg = String(
    (error as { message?: string } | null)?.message ?? error ?? ""
  ).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("offline") ||
    msg.includes("timeout") ||
    msg.includes("internet") ||
    msg.includes("timed out") ||
    msg.includes("network request failed")
  );
}

export async function isDeviceOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export async function assertOnlineForWrite(): Promise<void> {
  const online = await isDeviceOnline();
  if (!online) {
    throw new Error(
      "You're offline. Saved information is available, but changes require an internet connection."
    );
  }
}

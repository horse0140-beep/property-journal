import { Platform } from "react-native";

/** Base tab bar content height (icons + optional labels). */
export const TAB_BAR_BASE_HEIGHT = Platform.OS === "android" ? 56 : 52;

/** Extra bottom inset applied in tab layout (safe area). */
export const TAB_BAR_MIN_BOTTOM_INSET = Platform.OS === "android" ? 16 : 8;

/** Scroll content padding below tab screens so FABs/lists clear the tab bar. */
export const TAB_SCROLL_PADDING = 108;

export function tabBarHeight(bottomInset: number): number {
  return TAB_BAR_BASE_HEIGHT + Math.max(bottomInset, TAB_BAR_MIN_BOTTOM_INSET);
}

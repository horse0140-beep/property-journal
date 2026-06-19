import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Base tab bar content height (icons + optional labels). */
export const TAB_BAR_BASE_HEIGHT = Platform.OS === "android" ? 60 : 52;

/** Extra bottom inset applied in tab layout (safe area). */
export const TAB_BAR_MIN_BOTTOM_INSET = Platform.OS === "android" ? 20 : 8;

/** @deprecated Use tabScrollPadding(bottomInset) for dynamic sizing. */
export const TAB_SCROLL_PADDING = Platform.OS === "android" ? 116 : 108;

export function tabBarHeight(bottomInset: number): number {
  return TAB_BAR_BASE_HEIGHT + Math.max(bottomInset, TAB_BAR_MIN_BOTTOM_INSET);
}

/** Scroll content padding so lists clear the tab bar. */
export function tabScrollPadding(bottomInset: number): number {
  return tabBarHeight(bottomInset) + 16;
}

/** Hook for tab screen ScrollView contentContainerStyle. */
export function useTabScrollContentStyle() {
  const insets = useSafeAreaInsets();
  return {
    paddingHorizontal: 16,
    paddingBottom: tabScrollPadding(insets.bottom),
  };
}

import { ReactNode } from "react";
import { StatusBar, View } from "react-native";
import { useSegments } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, styles } from "@/constants/theme";
import { tabBarHeight } from "@/constants/layout";

type Props = {
  children: ReactNode;
  noPad?: boolean;
  /** Tab screen — scroll content handles bottom inset; no extra outer padding. */
  tabScreen?: boolean;
};

export function Screen({ children, noPad, tabScreen }: Props) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const inTabsGroup = segments[0] === "(tabs)";

  // Nested routes under (tabs) keep the bottom tab bar — clear it unless the
  // screen already pads via useTabScrollContentStyle (tabScreen).
  const bottomPad = tabScreen
    ? 0
    : inTabsGroup
      ? tabBarHeight(insets.bottom)
      : Math.max(insets.bottom, 8);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View
        style={[
          styles.screen,
          noPad && { paddingHorizontal: 0 },
          { paddingBottom: bottomPad },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

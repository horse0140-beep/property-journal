import { ReactNode } from "react";
import { SafeAreaView, StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, styles } from "@/constants/theme";
import { TAB_SCROLL_PADDING } from "@/constants/layout";

type Props = {
  children: ReactNode;
  noPad?: boolean;
  /** Add extra bottom padding for tab bar screens (default true when noPad). */
  tabScreen?: boolean;
};

export function Screen({ children, noPad, tabScreen }: Props) {
  const insets = useSafeAreaInsets();
  const isTab = tabScreen ?? noPad;
  const bottomPad = isTab
    ? TAB_SCROLL_PADDING
    : Math.max(insets.bottom, 8);

  return (
    <SafeAreaView style={styles.safeArea}>
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

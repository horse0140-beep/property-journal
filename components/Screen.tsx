import { ReactNode } from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, styles } from "@/constants/theme";

type Props = {
  children: ReactNode;
  noPad?: boolean;
  /** Tab screen — scroll content handles bottom inset; no extra outer padding. */
  tabScreen?: boolean;
};

export function Screen({ children, noPad, tabScreen }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = tabScreen ? 0 : Math.max(insets.bottom, 8);

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

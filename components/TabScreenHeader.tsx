import { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { colors } from "@/constants/theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Standard tab screen header — parent Screen already applies top safe area. */
export function TabScreenHeader({ children, style }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        backgroundColor: colors.bgCard,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

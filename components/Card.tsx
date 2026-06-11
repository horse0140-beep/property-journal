import { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { colors, styles } from "@/constants/theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
};

export function Card({ children, style, elevated }: Props) {
  return (
    <View style={[elevated ? styles.cardElevated : styles.card, style]}>
      {children}
    </View>
  );
}

import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

export function EmptyState({ icon, title, message }: Props) {
  return (
    <View style={styles.emptyState}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={34} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateText}>{message}</Text>
    </View>
  );
}

import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
};

export function Header({ title, subtitle, onBack, rightAction }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: colors.bgCard,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 12,
      }}
    >
      {onBack && (
        <Pressable
          onPress={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>{title}</Text>
        {subtitle && (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{subtitle}</Text>
        )}
      </View>
      {rightAction && (
        <Pressable
          onPress={rightAction.onPress}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={rightAction.icon} size={20} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

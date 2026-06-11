import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  backTo?: string;
  rightAction?: { label: string; onPress: () => void };
};

export function AdminHeader({ title, subtitle, backTo = "/admin", rightAction }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
        backgroundColor: colors.bgCard,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={styles.rowBetween}>
        <Pressable
          onPress={() => router.push(backTo as any)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Back</Text>
        </Pressable>
        {rightAction && (
          <Pressable onPress={rightAction.onPress}>
            <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 14 }}>
              {rightAction.label}
            </Text>
          </Pressable>
        )}
      </View>
      <Text style={[styles.screenTitle, { marginTop: 10, marginBottom: subtitle ? 2 : 0 }]}>
        {title}
      </Text>
      {subtitle && <Text style={styles.screenSubtitle}>{subtitle}</Text>}
    </View>
  );
}

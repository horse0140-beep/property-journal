import { View, Text, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import { WebHomeButton, goBackOrHome } from "@/components/WebHomeButton";

type Props = {
  title: string;
  subtitle?: string;
  backTo?: string;
  rightAction?: { label: string; onPress: () => void };
};

export function AdminHeader({ title, subtitle, backTo = "/admin", rightAction }: Props) {
  function handleBack() {
    if (backTo) {
      router.push(backTo as any);
      return;
    }
    goBackOrHome();
  }

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Pressable
            onPress={handleBack}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Back</Text>
          </Pressable>
          {Platform.OS === "web" ? (
            <Text style={{ color: colors.border, fontSize: 16 }}>|</Text>
          ) : null}
          <WebHomeButton />
        </View>
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

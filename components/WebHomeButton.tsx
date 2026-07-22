import { Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

type Props = {
  /** Compact icon-only for tight headers */
  compact?: boolean;
};

/** Web-only Home control. Native tabs stay unchanged (returns null). */
export function WebHomeButton({ compact = false }: Props) {
  if (Platform.OS !== "web") return null;

  return (
    <Pressable
      onPress={() => router.replace("/(tabs)")}
      hitSlop={10}
      accessibilityRole="link"
      accessibilityLabel="Home"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: compact ? 4 : 6,
        paddingHorizontal: compact ? 6 : 8,
      }}
    >
      <Ionicons name="home-outline" size={compact ? 20 : 18} color={colors.primary} />
      {!compact ? (
        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Home</Text>
      ) : null}
    </Pressable>
  );
}

/** Prefer back when history exists; otherwise go Home (web nested routes). */
export function goBackOrHome(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(tabs)");
}

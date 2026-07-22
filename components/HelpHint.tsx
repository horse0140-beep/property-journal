import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "@/constants/theme";

/** Compact contextual help link — keeps screens uncluttered. */
export function HelpHint({
  text,
  href = "/settings/help",
}: {
  text: string;
  href?: string;
}) {
  return (
    <Pressable
      onPress={() => router.push(href as "/settings/help")}
      accessibilityRole="link"
      accessibilityLabel={text}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 10,
        alignSelf: "flex-start",
      }}
    >
      <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </Pressable>
  );
}

import { Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { colors } from "@/constants/theme";

type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorCard({ message, onRetry }: Props) {
  return (
    <Card style={{ backgroundColor: colors.dangerBg, borderColor: colors.danger, marginBottom: 12 }}>
      <Text style={{ color: colors.danger, fontWeight: "600", lineHeight: 20 }}>{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: "800" }}>Tap to retry</Text>
        </Pressable>
      )}
    </Card>
  );
}

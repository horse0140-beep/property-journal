import { Text, Pressable } from "react-native";
import { Card } from "@/components/Card";
import { colors, styles } from "@/constants/theme";

export function AdminErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ backgroundColor: colors.dangerBg, borderColor: colors.danger, marginBottom: 12 }}>
      <Text style={{ color: colors.danger, fontWeight: "600" }}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={{ marginTop: 10 }}>
          <Text style={{ color: colors.danger, fontWeight: "800" }}>Tap to retry</Text>
        </Pressable>
      )}
    </Card>
  );
}

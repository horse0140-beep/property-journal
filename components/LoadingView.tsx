import { View, ActivityIndicator, Text } from "react-native";
import { colors } from "@/constants/theme";

type Props = {
  message?: string;
};

export function LoadingView({ message = "Loading…" }: Props) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.textMuted, marginTop: 14, fontSize: 14, fontWeight: "600" }}>
        {message}
      </Text>
    </View>
  );
}

import { ReactNode } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

type Props = {
  children: ReactNode;
};

export function AdminGate({ children }: Props) {
  const { isLoaded, isAdmin } = useAuth();

  if (!isLoaded) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!isAdmin) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: colors.bgSection,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="lock-closed" size={36} color={colors.textMuted} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
            Super Admin Required
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
            Only super_admin users can access the HomeWise Admin Dashboard.
          </Text>
          <Pressable
            style={[styles.primaryButton, { marginTop: 24, alignSelf: "stretch" }]}
            onPress={() => router.replace("/(tabs)/profile")}
          >
            <Text style={styles.primaryButtonText}>Back to Profile</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

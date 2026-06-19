import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/constants/theme";

/** Guarded by user_roles super_admin or owner email bypass. */
export default function AdminLayout() {
  const { isLoaded, isAdmin } = useAuth();

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      router.replace("/(tabs)/profile");
    }
  }, [isLoaded, isAdmin]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="pricing" />
      <Stack.Screen name="promo-codes" />
      <Stack.Screen name="subscriptions" />
      <Stack.Screen name="support" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="launch-readiness" />
      <Stack.Screen name="broadcast" />
    </Stack>
  );
}

import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HomeWiseProvider } from "@/context/HomeWiseContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { UpgradeProvider } from "@/context/UpgradeContext";
import { UpgradeModal } from "@/components/UpgradeModal";
import { colors } from "@/constants/theme";
import { setupNotificationListeners } from "@/lib/notifications";
import { registerPushToken } from "@/services/pushService";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";
    const inLegal = segments[0] === "legal";
    const inAdmin = segments[0] === "admin";

    if (inLegal || inAdmin) return;

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/auth/sign-in");
    } else if (isSignedIn && inAuthGroup && segments.at(1) !== "reset-password") {
      AsyncStorage.getItem("HOMEWISE_ONBOARDED_V1").then((v) => {
        router.replace(v === "1" ? "/(tabs)" : "/onboarding");
      });
    }
  }, [isLoaded, isSignedIn, segments]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function NotificationBootstrap() {
  const { user, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn || !user?.notificationsEnabled) return;

    registerPushToken(user.id).catch(() => {});
  }, [isSignedIn, user?.id, user?.notificationsEnabled]);

  useEffect(() => {
    const cleanup = setupNotificationListeners((data) => {
      if (data.type === "maintenance") {
        router.push("/(tabs)/maintenance");
      } else if (data.type === "warranty") {
        router.push("/(tabs)/vault");
      }
    });

    return cleanup;
  }, []);

  return null;
}

function DeepLinkHandler() {
  useEffect(() => {
    function handleUrl(url: string) {
      if (url.includes("reset-password") || url.includes("type=recovery")) {
        router.replace("/auth/reset-password");
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return null;
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <SubscriptionProvider>
      <UpgradeProvider>
        <HomeWiseProvider userId={user?.id}>
          <NotificationBootstrap />
          <DeepLinkHandler />
          {children}
          <UpgradeModal />
        </HomeWiseProvider>
      </UpgradeProvider>
    </SubscriptionProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppProviders>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth/sign-in" options={{ animation: "fade" }} />
              <Stack.Screen name="auth/sign-up" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="auth/forgot-password" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="auth/reset-password" options={{ animation: "fade" }} />
              <Stack.Screen name="onboarding/index" options={{ animation: "fade" }} />
              <Stack.Screen name="legal/privacy" options={{ presentation: "modal" }} />
              <Stack.Screen name="legal/terms" options={{ presentation: "modal" }} />
              <Stack.Screen name="ai" options={{ animation: "slide_from_bottom" }} />
              <Stack.Screen name="vault/photos" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="features" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="account" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="subscriptions" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
            </Stack>
          </AuthGate>
        </AppProviders>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

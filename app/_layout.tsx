import { Stack, router, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HomeWiseProvider, useHomeWise } from "@/context/HomeWiseContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { UpgradeProvider } from "@/context/UpgradeContext";
import { OfflineProvider, useOffline } from "@/context/OfflineContext";
import { UpgradeModal } from "@/components/UpgradeModal";
import { OfflineBanner } from "@/components/OfflineBanner";
import { setupNotificationListeners } from "@/lib/notifications";
import { isAuthCallbackUrl, isRecoveryUrl } from "@/lib/authSessionFromUrl";
import { extractShareTokenFromUrl } from "@/lib/shareUrl";
import { supportsRemotePush } from "@/lib/expoRuntime";
import { registerPushToken, subscribePushTokenChanges } from "@/services/pushService";
import { supabase } from "@/lib/supabase";

/** Deep navy — must match app.json splash.backgroundColor to avoid flash. */
const SPLASH_BG = "#0F2460";

// Keep the native splash up until auth bootstrap finishes (hide once).
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Synchronous web check — must not wait for expo-router hydration. */
function isPublicShareUrlSync(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  try {
    return /^\/share(\/|$)/i.test(window.location.pathname);
  } catch {
    return false;
  }
}

/** Public share links must render without waiting on auth bootstrap. */
function useIsPublicShareRoute(): boolean {
  const segments = useSegments();
  const pathname = usePathname();
  // Prefer sync URL first so cold mobile opens never paint the navy AuthGate.
  if (isPublicShareUrlSync()) return true;
  if (segments[0] === "share") return true;
  if (typeof pathname === "string" && pathname.startsWith("/share")) return true;
  return false;
}

function SplashController() {
  const { isLoaded } = useAuth();
  const inShare = useIsPublicShareRoute();
  const hidden = useRef(false);

  useEffect(() => {
    // Public share: never hold the splash / navy gate for auth.
    if (inShare || isLoaded || isPublicShareUrlSync()) {
      if (hidden.current) return;
      hidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoaded, inShare]);

  // Hide splash immediately on share cold start (before effects).
  if (isPublicShareUrlSync() && !hidden.current) {
    hidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }

  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const inShare = useIsPublicShareRoute() || isPublicShareUrlSync();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";
    const inLegal = segments[0] === "legal";
    const inAdmin = segments[0] === "admin";

    if (inLegal || inAdmin || inShare || segments[0] === "share") return;

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/auth/sign-in");
    } else if (
      isSignedIn &&
      inAuthGroup &&
      segments.at(1) !== "reset-password" &&
      segments.at(1) !== "confirm-email" &&
      segments.at(1) !== "callback"
    ) {
      AsyncStorage.getItem("HOMEWISE_ONBOARDED_V1").then((v) => {
        router.replace(v === "1" ? "/(tabs)" : "/onboarding");
      });
    }
  }, [isLoaded, isSignedIn, segments, inShare]);

  // CRITICAL: never block /share/* behind the navy auth splash (#0F2460).
  if (!isLoaded && !inShare) {
    return <View style={{ flex: 1, backgroundColor: SPLASH_BG }} />;
  }

  return <>{children}</>;
}

function NotificationBootstrap() {
  const { user, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn || !user?.notificationsEnabled || !supportsRemotePush()) return;

    void registerPushToken();
    const unsubscribe = subscribePushTokenChanges();
    return unsubscribe;
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
      const shareToken = extractShareTokenFromUrl(url);
      if (shareToken) {
        router.replace({ pathname: "/share/[token]", params: { token: shareToken } });
        return;
      }

      if (!isAuthCallbackUrl(url)) return;

      // Pass the URL through params — on warm starts getInitialURL() is stale
      // and the target screen's own listener may have missed the event.
      if (isRecoveryUrl(url)) {
        router.replace({ pathname: "/auth/reset-password", params: { url } });
        return;
      }

      router.replace({ pathname: "/auth/callback", params: { url } });
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return null;
}

function ConnectivityRefresh() {
  const { isOffline } = useOffline();
  const { isSignedIn } = useAuth();
  const { refreshData } = useHomeWise();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current || !isSignedIn) return;
    wasOffline.current = false;
    // Connection restored — refresh session then property data.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Trigger auth state listeners / profile refresh via getUser path.
        void supabase.auth.getUser().catch(() => {});
      }
      void refreshData();
    });
  }, [isOffline, isSignedIn, refreshData]);

  return null;
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const inShare = useIsPublicShareRoute() || isPublicShareUrlSync();

  // Public share: skip authenticated app chrome (HomeWise loaders, upgrade modal, etc.).
  if (inShare) {
    return <>{children}</>;
  }

  return (
    <OfflineProvider>
      <SubscriptionProvider>
        <UpgradeProvider>
          <HomeWiseProvider isSignedIn={isSignedIn}>
            <NotificationBootstrap />
            <DeepLinkHandler />
            <ConnectivityRefresh />
            <OfflineBanner />
            {children}
            <UpgradeModal />
          </HomeWiseProvider>
        </UpgradeProvider>
      </SubscriptionProvider>
    </OfflineProvider>
  );
}

export default function RootLayout() {
  const publicShare = isPublicShareUrlSync();

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/sign-in" options={{ animation: "fade" }} />
      <Stack.Screen name="auth/sign-up" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="auth/forgot-password" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="auth/reset-password" options={{ animation: "fade" }} />
      <Stack.Screen name="auth/callback" options={{ animation: "fade" }} />
      <Stack.Screen name="auth/confirm-email" options={{ animation: "fade" }} />
      <Stack.Screen name="onboarding/index" options={{ animation: "fade" }} />
      <Stack.Screen name="legal/privacy" options={{ presentation: "modal" }} />
      <Stack.Screen name="legal/terms" options={{ presentation: "modal" }} />
      <Stack.Screen name="ai" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="vault/photos" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="share" options={{ animation: "fade" }} />
    </Stack>
  );

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SplashController />
        <StatusBar style="dark" />
        {publicShare ? (
          // Cold /share/* open: skip AuthGate navy + authenticated providers.
          stack
        ) : (
          <AppProviders>
            <AuthGate>{stack}</AuthGate>
          </AppProviders>
        )}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

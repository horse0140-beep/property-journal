import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import {
  createSessionFromUrl,
  isRecoveryUrl,
  parseParamsFromUrl,
} from "@/lib/authSessionFromUrl";
import { colors, styles } from "@/constants/theme";

export default function AuthCallbackScreen() {
  const { url: urlParam } = useLocalSearchParams<{ url?: string }>();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // While a recovery link is being handled, the SIGNED_IN event it fires must
  // not route the user into the app — they need the reset-password screen.
  const handlingRecovery = useRef(false);

  const finishSignIn = useCallback(async () => {
    const onboarded = await AsyncStorage.getItem("HOMEWISE_ONBOARDED_V1");
    router.replace(onboarded === "1" ? "/(tabs)" : "/onboarding");
  }, []);

  const handleAuthUrl = useCallback(async (url?: string | null) => {
    try {
      if (url) {
        const recovery = isRecoveryUrl(url) || parseParamsFromUrl(url).type === "recovery";
        if (recovery) handlingRecovery.current = true;

        const created = await createSessionFromUrl(url);
        if (created) {
          if (recovery) {
            router.replace("/auth/reset-password");
            return;
          }
          setReady(true);
          setError(null);
          return;
        }

        if (recovery) handlingRecovery.current = false;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setReady(true);
        setError(null);
      } else {
        setError(
          url
            ? "This link is invalid or has expired. Request a new one and open it on this device."
            : "No confirmation link was found. Open the link from your email on this device."
        );
      }
    } catch (e: unknown) {
      handlingRecovery.current = false;
      const message =
        e instanceof Error ? e.message : "Invalid or expired confirmation link.";
      setError(message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (urlParam) {
      void handleAuthUrl(urlParam);
    } else {
      Linking.getInitialURL().then((url) => handleAuthUrl(url));
    }

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      setChecking(true);
      handleAuthUrl(url);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        handlingRecovery.current = true;
        router.replace("/auth/reset-password");
        return;
      }
      if (handlingRecovery.current) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session) {
        setReady(true);
        setChecking(false);
        setError(null);
      }
    });

    return () => {
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [handleAuthUrl, urlParam]);

  useEffect(() => {
    if (ready && !checking) {
      finishSignIn();
    }
  }, [ready, checking, finishSignIn]);

  if (checking) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted, marginTop: 16, textAlign: "center" }}>
          Confirming your account…
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.dangerBg,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="mail-unread-outline" size={36} color={colors.danger} />
        </View>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 20,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          Could not confirm email
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            marginTop: 10,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          {error}
        </Text>
        <Pressable
          style={[styles.primaryButton, { marginTop: 24, alignSelf: "stretch" }]}
          onPress={() => router.replace("/auth/sign-in")}
        >
          <Text style={styles.primaryButtonText}>Back to Sign In</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={() => router.replace("/auth/sign-up")}>
          <Text style={styles.ghostButtonText}>Create Account</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.textMuted, marginTop: 16, textAlign: "center" }}>
        Email confirmed — opening HomeWise…
      </Text>
    </SafeAreaView>
  );
}

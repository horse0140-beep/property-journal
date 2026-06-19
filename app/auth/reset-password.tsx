import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { colors, styles } from "@/constants/theme";

function HomeWiseLogo() {
  return (
    <View style={{ alignItems: "center", marginBottom: 32 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name="home" size={36} color="#fff" />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Text style={{ color: colors.primary, fontSize: 32, fontWeight: "900" }}>HOME</Text>
        <Text style={{ color: colors.accent, fontSize: 32, fontWeight: "900" }}>WISE</Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
        The CarFax for Your House™
      </Text>
    </View>
  );
}

function parseParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");

  const paramString =
    hashIndex !== -1
      ? url.slice(hashIndex + 1)
      : queryIndex !== -1
        ? url.slice(queryIndex + 1)
        : "";

  for (const segment of paramString.split("&")) {
    if (!segment) continue;
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(segment.slice(0, eq));
    const value = decodeURIComponent(segment.slice(eq + 1));
    params[key] = value;
  }

  return params;
}

async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = parseParamsFromUrl(url);

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw new Error(error.message);
    return true;
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(error.message);
    return true;
  }

  return false;
}

type FieldErrors = {
  password?: string;
  confirm?: string;
  general?: string;
};

export default function ResetPasswordScreen() {
  const { updatePasswordFromRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const verifyRecoverySession = useCallback(async (url?: string | null) => {
    try {
      if (url) {
        const created = await createSessionFromUrl(url);
        if (created) {
          setReady(true);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invalid or expired reset link.";
      setErrors({ general: message });
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => verifyRecoverySession(url));

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      setCheckingSession(true);
      verifyRecoverySession(url);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setCheckingSession(false);
        setErrors({});
      }
    });

    return () => {
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [verifyRecoverySession]);

  function validate(): boolean {
    const next: FieldErrors = {};

    if (!password) {
      next.password = "Password is required.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }

    if (!confirm) {
      next.confirm = "Please confirm your password.";
    } else if (password !== confirm) {
      next.confirm = "Passwords do not match.";
    }

    setErrors(next);
    return !next.password && !next.confirm;
  }

  async function handleSave() {
    setErrors({});

    if (!validate()) return;

    setLoading(true);
    const result = await updatePasswordFromRecovery(password);
    setLoading(false);

    if (result.error) {
      setErrors({ general: result.error });
      return;
    }

    Alert.alert(
      "Password Updated",
      "Your password has been changed successfully. You are now signed in.",
      [{ text: "Continue", onPress: () => router.replace("/(tabs)") }]
    );
  }

  if (checkingSession) {
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
          Verifying reset link…
        </Text>
      </SafeAreaView>
    );
  }

  if (!ready) {
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
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="link-outline" size={36} color={colors.textMuted} />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800", textAlign: "center" }}>
          Open your reset link
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 10, textAlign: "center", lineHeight: 22 }}>
          Tap the link in your password reset email to continue. The link expires after a short time.
        </Text>
        {errors.general ? (
          <View
            style={{
              backgroundColor: colors.dangerBg,
              borderRadius: 10,
              padding: 12,
              marginTop: 20,
              flexDirection: "row",
              gap: 8,
              alignSelf: "stretch",
            }}
          >
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{errors.general}</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.primaryButton, { marginTop: 24, alignSelf: "stretch" }]}
          onPress={() => router.replace("/auth/forgot-password")}
        >
          <Text style={styles.primaryButtonText}>Request New Link</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={() => router.replace("/auth/sign-in")}>
          <Text style={styles.ghostButtonText}>Back to Sign In</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirm;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <HomeWiseLogo />

          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.bgSection,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>
                New Password
              </Text>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24, lineHeight: 20 }}>
              Choose a strong password for your HomeWise account.
            </Text>

            {errors.general ? (
              <View
                style={{
                  backgroundColor: colors.dangerBg,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{errors.general}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>New Password</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={[
                  styles.input,
                  { paddingRight: 48 },
                  errors.password ? { borderColor: colors.danger } : null,
                ]}
                placeholder="Min. 8 characters"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setErrors((e) => ({ ...e, password: undefined, general: undefined }));
                }}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!loading}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {errors.password ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{errors.password}</Text>
            ) : null}

            <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={[
                  styles.input,
                  { paddingRight: 48 },
                  errors.confirm ? { borderColor: colors.danger } : null,
                ]}
                placeholder="Repeat new password"
                placeholderTextColor={colors.textMuted}
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  setErrors((e) => ({ ...e, confirm: undefined, general: undefined }));
                }}
                secureTextEntry={!showConfirm}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!loading}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {errors.confirm ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{errors.confirm}</Text>
            ) : null}

            <View
              style={{
                backgroundColor: colors.bgSection,
                borderRadius: 12,
                padding: 14,
                marginTop: 16,
                gap: 8,
              }}
            >
              <RequirementRow met={hasMinLength} label="At least 8 characters" />
              <RequirementRow met={passwordsMatch} label="Passwords match" />
            </View>

            <Pressable
              style={[styles.primaryButton, { marginTop: 20 }, loading && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.ghostButton}
              onPress={() => router.replace("/auth/sign-in")}
              disabled={loading}
            >
              <Text style={styles.ghostButtonText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RequirementRow({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons
        name={met ? "checkmark-circle" : "ellipse-outline"}
        size={18}
        color={met ? colors.success : colors.textMuted}
      />
      <Text style={{ color: met ? colors.textPrimary : colors.textMuted, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

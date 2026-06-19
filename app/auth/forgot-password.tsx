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
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
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

export default function ForgotPasswordScreen() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  function validateEmail(): boolean {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setFieldError("Email is required.");
      return false;
    }
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setFieldError("Enter a valid email address.");
      return false;
    }
    setFieldError("");
    return true;
  }

  async function handleSend() {
    setError("");
    if (!validateEmail()) return;

    setLoading(true);
    const result = await resetPasswordForEmail(email.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSent(true);
  }

  async function handleResend() {
    setSent(false);
    setError("");
    await handleSend();
  }

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
                <Ionicons name="key-outline" size={22} color={colors.primary} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>
                Forgot Password
              </Text>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24, lineHeight: 20 }}>
              Enter the email on your HomeWise account. We will send a secure link to reset your password.
            </Text>

            {sent ? (
              <>
                <View
                  style={{
                    backgroundColor: colors.successBg,
                    borderRadius: 14,
                    padding: 18,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: colors.success,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                    <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.success,
                          fontWeight: "800",
                          fontSize: 16,
                          marginBottom: 6,
                        }}
                      >
                        Reset email sent
                      </Text>
                      <Text style={{ color: colors.textSecondary, lineHeight: 22, fontSize: 14 }}>
                        Check your inbox at{" "}
                        <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                          {email.trim().toLowerCase()}
                        </Text>
                        . Tap the link in the email to set a new password.
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  style={[styles.secondaryButton, loading && { opacity: 0.7 }]}
                  onPress={handleResend}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                      <Text style={styles.secondaryButtonText}>Resend Email</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                {error ? (
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
                    <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, fieldError ? { borderColor: colors.danger } : null]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setFieldError("");
                    setError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCorrect={false}
                  editable={!loading}
                />
                {fieldError ? (
                  <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{fieldError}</Text>
                ) : null}

                <Pressable
                  style={[styles.primaryButton, { marginTop: 20 }, loading && { opacity: 0.7 }]}
                  onPress={handleSend}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="mail-outline" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>Send Reset Email</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

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

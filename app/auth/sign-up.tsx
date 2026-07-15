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

const SIGNUP_BENEFITS = [
  { icon: "shield-checkmark-outline", text: "Track repairs, warranties, and appliances" },
  { icon: "document-text-outline", text: "Generate your Home History Report™" },
  { icon: "sparkles-outline", text: "AI assistant knows your home inside-out" },
  { icon: "trending-up-outline", text: "Increase buyer confidence when you sell" },
] as const;

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmationSent, setConfirmationSent] = useState(false);

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Full name is required";
    if (!email.trim()) nextErrors.email = "Email is required";
    else if (!email.includes("@")) nextErrors.email = "Enter a valid email address";
    if (!password) nextErrors.password = "Password is required";
    else if (password.length < 8) nextErrors.password = "Password must be at least 8 characters";
    if (password !== confirm) nextErrors.confirm = "Passwords do not match";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const result = await signUp(email.trim().toLowerCase(), password, name.trim());
      if (result.error) {
        setErrors({ general: result.error });
        setLoading(false);
        return;
      }
      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
        setLoading(false);
        return;
      }
      // Signed in immediately (confirmation disabled) — keep the spinner and
      // let AuthGate route to onboarding once the session is applied.
    } catch (e) {
      setErrors({ general: e instanceof Error ? e.message : "Sign up failed. Please try again." });
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Sign In</Text>
          </Pressable>

          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: "800",
                marginBottom: 4,
              }}
            >
              Create your account
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>
              Start protecting your home&apos;s history for free.
            </Text>

            {confirmationSent ? (
              <View
                style={{
                  backgroundColor: colors.successBg,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Ionicons name="mail-outline" size={16} color={colors.success} />
                <Text style={{ color: colors.success, flex: 1, fontSize: 14 }}>
                  Account created! Check your email and tap the confirmation link to finish signing up.
                </Text>
              </View>
            ) : null}

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

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name ? { borderColor: colors.danger } : null]}
              placeholder="Jane Smith"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              blurOnSubmit={false}
            />
            {errors.name ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                {errors.name}
              </Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? { borderColor: colors.danger } : null]}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              blurOnSubmit={false}
            />
            {errors.email ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                {errors.email}
              </Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}

            <Text style={styles.label}>Password</Text>
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
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                blurOnSubmit={false}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {errors.password ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                {errors.password}
              </Text>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 12 }}>
                At least 8 characters
              </Text>
            )}

            <Text style={styles.label}>Confirm Password</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={[
                  styles.input,
                  { paddingRight: 48 },
                  errors.confirm ? { borderColor: colors.danger } : null,
                ]}
                placeholder="Repeat your password"
                placeholderTextColor={colors.textMuted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {errors.confirm ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                {errors.confirm}
              </Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}

            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 16, lineHeight: 18 }}>
              By creating an account you agree to our{" "}
              <Text
                style={{ color: colors.primary, fontWeight: "700" }}
                onPress={() => router.push("/legal/terms")}
              >
                Terms of Service
              </Text>
              {" "}and{" "}
              <Text
                style={{ color: colors.primary, fontWeight: "700" }}
                onPress={() => router.push("/legal/privacy")}
              >
                Privacy Policy
              </Text>
              .
            </Text>

            <Pressable
              style={[styles.primaryButton, { marginTop: 20 }, loading ? { opacity: 0.7 } : null]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 16,
              padding: 20,
              marginTop: 20,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
            }}
          >
            {SIGNUP_BENEFITS.map((benefit) => (
              <View key={benefit.text} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name={benefit.icon} size={20} color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{benefit.text}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>Already have an account?</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

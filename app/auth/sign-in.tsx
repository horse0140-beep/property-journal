import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, SafeAreaView,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { colors, styles } from "@/constants/theme";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!email.includes("@")) e.email = "Enter a valid email address";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSignIn() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const result = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.error) {
      setErrors({ general: result.error });
    } else {
      router.replace("/(tabs)");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Ionicons name="home" size={36} color="#fff" />
          </View>
          <View style={{ flexDirection: "row" }}>
            <Text style={{ color: colors.primary, fontSize: 32, fontWeight: "900" }}>HOME</Text>
            <Text style={{ color: colors.accent, fontSize: 32, fontWeight: "900" }}>WISE</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>The CarFax for Your House™</Text>
        </View>

        {/* Card */}
        <View style={{ backgroundColor: colors.bgCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800", marginBottom: 6 }}>Welcome back</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>Sign in to your HomeWise account</Text>

          {errors.general && (
            <View style={{ backgroundColor: colors.dangerBg, borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: "row", gap: 8 }}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{errors.general}</Text>
            </View>
          )}

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, errors.email ? { borderColor: colors.danger } : null]}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          {errors.email && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{errors.email}</Text>}

          {/* Password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <View style={{ position: "relative" }}>
            <TextInput
              style={[styles.input, { paddingRight: 48 }, errors.password ? { borderColor: colors.danger } : null]}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
            >
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          {errors.password && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{errors.password}</Text>}

          <Pressable onPress={() => router.push("/auth/forgot-password")} style={{ alignSelf: "flex-end", marginTop: 8 }}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600" }}>Forgot password?</Text>
          </Pressable>

          {/* Sign in button */}
          <Pressable
            style={[styles.primaryButton, { marginTop: 20 }, loading && { opacity: 0.7 }]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Sign up link */}
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>Don't have an account?</Text>
          <Pressable onPress={() => router.push("/auth/sign-up")}>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>Sign Up Free</Text>
          </Pressable>
        </View>

        {/* Demo shortcut */}
        <Pressable
          onPress={() => { setEmail("demo@homewise.app"); setPassword("demo1234"); }}
          style={{ marginTop: 12, alignItems: "center" }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Use demo account</Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

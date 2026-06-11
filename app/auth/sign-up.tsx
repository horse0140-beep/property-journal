import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, SafeAreaView,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { colors, styles } from "@/constants/theme";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!email.includes("@")) e.email = "Enter a valid email address";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (password !== confirm) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const result = await signUp(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);
    if (result.error) {
      setErrors({ general: result.error });
    } else {
      router.replace("/onboarding");
    }
  }

  function Field({
    label, value, onChange, placeholder, secure, keyboardType, autoComplete, textContentType, error, hint,
  }: any) {
    const [show, setShow] = useState(false);
    return (
      <View style={{ marginBottom: 4 }}>
        <Text style={styles.label}>{label}</Text>
        <View style={{ position: "relative" }}>
          <TextInput
            style={[styles.input, { paddingRight: secure ? 48 : 14 }, error ? { borderColor: colors.danger } : null]}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            value={value}
            onChangeText={(v) => { onChange(v); setErrors((e) => ({ ...e, [label.toLowerCase()]: undefined })); }}
            secureTextEntry={secure && !show}
            keyboardType={keyboardType ?? "default"}
            autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
            autoComplete={autoComplete}
            textContentType={textContentType}
          />
          {secure && (
            <Pressable onPress={() => setShow((v) => !v)} style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        {error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
        {hint && !error && <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{hint}</Text>}
      </View>
    );
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
        {/* Back */}
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Sign In</Text>
        </Pressable>

        <View style={{ backgroundColor: colors.bgCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Create your account</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>Start protecting your home's history for free.</Text>

          {errors.general && (
            <View style={{ backgroundColor: colors.dangerBg, borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: "row", gap: 8 }}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{errors.general}</Text>
            </View>
          )}

          <Field label="Full Name" value={name} onChange={setName} placeholder="Jane Smith" error={errors.name} autoComplete="name" textContentType="name" />
          <Field label="Email Address" value={email} onChange={setEmail} placeholder="you@example.com" keyboardType="email-address" error={errors.email} autoComplete="email" textContentType="emailAddress" />
          <Field label="Password" value={password} onChange={setPassword} placeholder="Min. 8 characters" secure error={errors.password} hint={!errors.password ? "At least 8 characters" : undefined} autoComplete="new-password" textContentType="newPassword" />
          <Field label="Confirm Password" value={confirm} onChange={setConfirm} placeholder="Repeat your password" secure error={errors.confirm} autoComplete="new-password" textContentType="newPassword" />

          {/* Terms */}
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 16, lineHeight: 18 }}>
            By creating an account you agree to our{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }} onPress={() => router.push("/legal/terms")}>Terms of Service</Text>
            {" "}and{" "}
            <Text style={{ color: colors.primary, fontWeight: "700" }} onPress={() => router.push("/legal/privacy")}>Privacy Policy</Text>.
          </Text>

          <Pressable
            style={[styles.primaryButton, { marginTop: 20 }, loading && { opacity: 0.7 }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create Account</Text>}
          </Pressable>
        </View>

        {/* Benefits */}
        <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, marginTop: 20, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
          {[
            { icon: "shield-checkmark-outline", text: "Track repairs, warranties, and appliances" },
            { icon: "document-text-outline",    text: "Generate your Home History Report™" },
            { icon: "sparkles-outline",         text: "AI assistant knows your home inside-out" },
            { icon: "trending-up-outline",      text: "Increase buyer confidence when you sell" },
          ].map((b) => (
            <View key={b.text} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name={b.icon as any} size={20} color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{b.text}</Text>
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

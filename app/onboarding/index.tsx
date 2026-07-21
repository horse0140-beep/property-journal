import {
  View, Text, Pressable, ScrollView,
  TextInput, ActivityIndicator, Dimensions, SafeAreaView,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { requestNotificationPermission } from "@/lib/notifications";
import { registerPushToken } from "@/services/pushService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ONBOARDING_KEY = "HOMEWISE_ONBOARDED_V1";

export async function markOnboarded() {
  await AsyncStorage.setItem(ONBOARDING_KEY, "1");
}
export async function hasOnboarded(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ONBOARDING_KEY);
  return v === "1";
}

type Step = "welcome" | "property" | "features" | "notifications";

const FEATURES = [
  { icon: "construct-outline",        title: "Maintenance Tracking",   desc: "Never miss a service. Get reminders before things break." },
  { icon: "document-text-outline",    title: "Document Vault",         desc: "Store warranties, receipts, and inspection reports." },
  { icon: "trending-up-outline",      title: "Home Health Score™",     desc: "See your home's condition at a glance, 0–100." },
  { icon: "sparkles-outline",         title: "AI Home Assistant",      desc: "Ask anything about your home — it knows every detail." },
  { icon: "share-social-outline",     title: "Home History Report™",   desc: "Impress buyers with a complete, shareable report." },
];

export default function OnboardingScreen() {
  const { addProperty, selectProperty, properties } = useHomeWise();
  const { user, updateProfile } = useAuth();

  const [step, setStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);

  // Property form
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [sqft, setSqft] = useState("");
  const [propError, setPropError] = useState("");

  async function finishOnboarding(enableNotifications = false) {
    setSaving(true);

    if (enableNotifications) {
      const granted = await requestNotificationPermission();
      if (granted) {
        await updateProfile({ notificationsEnabled: true });
        if (user?.id) {
          await registerPushToken().catch(() => {});
        }
      }
    }

    await markOnboarded();
    setSaving(false);
    router.replace("/(tabs)");
  }

  async function savePropertyAndContinue() {
    if (!address.trim() || !city.trim()) {
      setPropError("Please enter at least the street address and city.");
      return;
    }
    setPropError("");
    addProperty({
      nickname: "My Home",
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zip: zip.trim(),
      type: "primary",
      yearBuilt: yearBuilt.trim(),
      squareFeet: sqft.trim(),
      bedrooms: "",
      bathrooms: "",
      purchasePrice: "",
      estimatedValue: "",
      purchaseDate: "",
    });
    // Select the newly added property (it will be the last one added)
    // We select after a tick so state has updated
    setTimeout(() => {
      const all = properties;
      if (all.length > 0) {
        // The new property is appended to the end
        const newest = all[all.length - 1];
        if (newest) selectProperty(newest.id);
      }
    }, 100);
    setStep("features");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>

      {/* ── Welcome ──────────────────────────────────────────────── */}
      {step === "welcome" && (
        <View style={{ flex: 1, justifyContent: "space-between", padding: 32 }}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <View style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
              <Ionicons name="home" size={52} color="#fff" />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 30, fontWeight: "900", textAlign: "center", lineHeight: 36 }}>
              Welcome to Property Journal{user?.name ? `,\n${user.name.split(" ")[0]}` : ""}!
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: "center", marginTop: 14, lineHeight: 24 }}>
              You&apos;re about to create the most complete record of your home ever made.
            </Text>
            <View style={{ marginTop: 32, gap: 14, width: "100%" }}>
              {[
                "Track every repair, receipt, and warranty",
                "Know your Home Health Score in real time",
                "Generate a seller report that impresses buyers",
              ].map((t) => (
                <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="checkmark" size={14} color={colors.success} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 15, flex: 1 }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setStep("property")}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* ── Add First Property ────────────────────────────────────── */}
      {step === "property" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
        >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={{ marginBottom: 28, marginTop: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>STEP 1 OF 3</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "900", marginTop: 6 }}>Add Your Home</Text>
            <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 6 }}>You can add more properties later.</Text>
          </View>

          {propError ? (
            <View style={{ backgroundColor: colors.dangerBg, borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: "row", gap: 8 }}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={{ color: colors.danger, flex: 1 }}>{propError}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Street Address *</Text>
          <TextInput style={styles.input} placeholder="123 Maple Street" placeholderTextColor={colors.textMuted} value={address} onChangeText={setAddress} />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} placeholder="Austin" placeholderTextColor={colors.textMuted} value={city} onChangeText={setCity} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>State</Text>
              <TextInput style={styles.input} placeholder="TX" placeholderTextColor={colors.textMuted} value={state} onChangeText={setState} maxLength={2} autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ZIP</Text>
              <TextInput style={styles.input} placeholder="78701" placeholderTextColor={colors.textMuted} value={zip} onChangeText={setZip} keyboardType="numeric" maxLength={5} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Year Built</Text>
              <TextInput style={styles.input} placeholder="2010" placeholderTextColor={colors.textMuted} value={yearBuilt} onChangeText={setYearBuilt} keyboardType="numeric" maxLength={4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sq Footage</Text>
              <TextInput style={styles.input} placeholder="2,000" placeholderTextColor={colors.textMuted} value={sqft} onChangeText={setSqft} keyboardType="numeric" />
            </View>
          </View>

          <Pressable style={[styles.primaryButton, { marginTop: 24 }]} onPress={savePropertyAndContinue}>
            <Text style={styles.primaryButtonText}>Save & Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
          <Pressable style={styles.ghostButton} onPress={() => setStep("features")}>
            <Text style={styles.ghostButtonText}>Skip for now</Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── Features overview ─────────────────────────────────────── */}
      {step === "features" && (
        <View style={{ flex: 1, padding: 24, justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <View style={{ marginBottom: 24, marginTop: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>STEP 2 OF 3</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "900", marginTop: 6 }}>Everything in one place</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {FEATURES.map((f) => (
                <View key={f.title} style={{ flexDirection: "row", gap: 16, marginBottom: 22, alignItems: "flex-start" }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
                    <Ionicons name={f.icon as any} size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{f.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2, lineHeight: 20 }}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setStep("notifications")}>
            <Text style={styles.primaryButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* ── Notifications permission ──────────────────────────────── */}
      {step === "notifications" && (
        <View style={{ flex: 1, padding: 32, justifyContent: "space-between" }}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <View style={{ width: 90, height: 90, borderRadius: 26, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center", marginBottom: 28, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="notifications" size={44} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}>STEP 3 OF 3</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "900", textAlign: "center" }}>Stay on top of it all</Text>
            <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: "center", marginTop: 14, lineHeight: 24 }}>
              Property Journal sends smart reminders so you never miss maintenance or let a warranty expire.
            </Text>
            <View style={{ marginTop: 32, gap: 14, width: "100%" }}>
              {[
                { icon: "construct-outline",     text: "Maintenance due reminders" },
                { icon: "shield-outline",        text: "Warranty expiration alerts" },
                { icon: "calendar-outline",      text: "Seasonal home prep tips" },
              ].map((n) => (
                <View key={n.text} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.bgSection, padding: 14, borderRadius: 12 }}>
                  <Ionicons name={n.icon as any} size={20} color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{n.text}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Pressable
              style={[styles.primaryButton, saving && { opacity: 0.7 }]}
              onPress={() => finishOnboarding(true)}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <>
                <Text style={styles.primaryButtonText}>Enable Notifications</Text>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              </>}
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => finishOnboarding(false)}>
              <Text style={styles.ghostButtonText}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
    </SafeAreaView>
  );
}

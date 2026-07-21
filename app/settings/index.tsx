import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "@/components/Screen";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import {
  requestNotificationPermission,
  sendTestNotification,
} from "@/lib/notifications";
import { registerPushToken } from "@/services/pushService";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 20, marginHorizontal: 16 }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 1,
          marginBottom: 6,
          marginLeft: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: 14,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  toggle,
  toggleValue,
  onToggle,
  danger,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={toggle ? undefined : onPress}
      disabled={toggle && !onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        gap: 12,
      }}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={danger ? colors.danger : colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: danger ? colors.danger : colors.textPrimary,
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
        {value ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{value}</Text>
        ) : null}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const { isOffline } = useOffline();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const version =
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    "2.0.0";

  async function handleToggle(
    key: "maintenanceReminders" | "warrantyAlerts",
    value: boolean
  ) {
    if (saving || isOffline) {
      if (isOffline) {
        Alert.alert(
          "You're Offline",
          "Saved information is available, but changes require an internet connection."
        );
      }
      return;
    }
    setSaving(true);
    try {
      if (key === "maintenanceReminders" && value) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            "Permission Required",
            "Enable notifications in your device settings to receive reminders."
          );
          return;
        }
        await registerPushToken().catch(() => {});
      }
      const result = await updateProfile({ [key]: value });
      if (result?.error) Alert.alert("Save Failed", result.error);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestNotification() {
    if (isOffline) {
      Alert.alert(
        "You're Offline",
        "Test notifications require an internet connection."
      );
      return;
    }
    setTesting(true);
    try {
      const ok = await sendTestNotification();
      if (!ok) {
        Alert.alert(
          "Notifications Disabled",
          "Allow notification permission in your device settings first."
        );
      }
    } catch (e) {
      Alert.alert(
        "Test Failed",
        e instanceof Error ? e.message : "Could not schedule the test notification."
      );
    } finally {
      setTesting(false);
    }
  }

  function openDeviceSettings() {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:").catch(() => {});
    } else {
      Linking.openSettings().catch(() => {});
    }
  }

  async function clearLocalCache() {
    Alert.alert(
      "Clear Local Cache",
      "This clears temporary on-device cache (score history, onboarding flags). Your cloud account data is not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(
                (k) =>
                  k.startsWith("HOMEWISE_SCORE_") ||
                  k.startsWith("HOMEWISE_IMMEDIATE_PING_") ||
                  k === "HOMEWISE_ONBOARDED_V1"
              );
              if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
              Alert.alert("Done", "Local cache cleared.");
            } catch (e) {
              Alert.alert(
                "Clear Failed",
                e instanceof Error ? e.message : "Could not clear cache."
              );
            }
          },
        },
      ]
    );
  }

  function confirmSignOut() {
    Alert.alert("Sign Out", "Sign out of Property Journal on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => void signOut(),
      },
    ]);
  }

  return (
    <Screen noPad>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.bgCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Section title="ACCOUNT">
          <Row
            icon="person-outline"
            label="Profile"
            value={user?.email ?? undefined}
            onPress={() => router.push("/(tabs)/profile")}
          />
          <Row
            icon="log-out-outline"
            label="Sign Out"
            onPress={confirmSignOut}
            danger
            last
          />
        </Section>

        <Section title="NOTIFICATIONS">
          <Row
            icon="construct-outline"
            label="Maintenance Reminders"
            toggle
            toggleValue={user?.maintenanceReminders ?? true}
            onToggle={(v) => void handleToggle("maintenanceReminders", v)}
          />
          <Row
            icon="shield-outline"
            label="Warranty Alerts"
            toggle
            toggleValue={user?.warrantyAlerts ?? true}
            onToggle={(v) => void handleToggle("warrantyAlerts", v)}
          />
          <Row
            icon="notifications-outline"
            label={testing ? "Sending…" : "Send Test Notification"}
            onPress={() => void handleTestNotification()}
          />
          <Row
            icon="phone-portrait-outline"
            label="Device Notification Settings"
            onPress={openDeviceSettings}
          />
          <Row
            icon="options-outline"
            label="All Notification Preferences"
            onPress={() => router.push("/notifications/settings")}
            last
          />
        </Section>

        <Section title="APP">
          <Row icon="information-circle-outline" label="App Version" value={version} />
          <Row
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => router.push("/legal/privacy")}
          />
          <Row
            icon="reader-outline"
            label="Terms of Service"
            onPress={() => router.push("/legal/terms")}
          />
          <Row
            icon="help-circle-outline"
            label="Help / FAQ"
            onPress={() =>
              Alert.alert(
                "Help Center",
                "For help and support, email us at:\n\nsupport@homewise.app\n\nWe typically respond within 24 hours."
              )
            }
          />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Contact Support"
            onPress={() => router.push("/(tabs)/profile")}
            last
          />
        </Section>

        <Section title="DATA">
          <Row
            icon="trash-bin-outline"
            label="Clear Local Cache"
            onPress={clearLocalCache}
          />
          <Row
            icon="warning-outline"
            label="Delete Account"
            onPress={() => router.push("/account/delete")}
            danger
            last
          />
        </Section>

        {saving ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

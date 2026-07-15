import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Switch,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useHomeWise } from "@/context/HomeWiseContext";
import { displayPlanLabel } from "@/lib/premium";
import {
  cancelAllNotifications,
  requestNotificationPermission,
  scheduleAllNotifications,
  sendTestNotification,
} from "@/lib/notifications";
import { registerPushToken, unregisterPushTokens } from "@/services/pushService";
import { getSubscriptionRenewalDate } from "@/services/notificationService";

type PrefKey =
  | "notificationsEnabled"
  | "maintenanceReminders"
  | "warrantyAlerts"
  | "applianceReminders"
  | "subscriptionReminders"
  | "adminBroadcasts"
  | "emailDigest";

const PREF_ROWS: {
  key: PrefKey;
  icon: string;
  label: string;
  description: string;
}[] = [
  {
    key: "maintenanceReminders",
    icon: "construct-outline",
    label: "Maintenance Reminders",
    description: "Alerts 3 days before maintenance is due",
  },
  {
    key: "warrantyAlerts",
    icon: "shield-outline",
    label: "Warranty Expiration",
    description: "30-day and 7-day warranty expiration warnings",
  },
  {
    key: "applianceReminders",
    icon: "hardware-chip-outline",
    label: "Appliance Replacement",
    description: "Reminders when appliances near end of life",
  },
  {
    key: "subscriptionReminders",
    icon: "card-outline",
    label: "Subscription Renewal",
    description: "Renewal reminders for your HomeWise plan",
  },
  {
    key: "adminBroadcasts",
    icon: "megaphone-outline",
    label: "Admin Announcements",
    description: "Important updates from the HomeWise team",
  },
  {
    key: "emailDigest",
    icon: "mail-outline",
    label: "Weekly Email Digest",
    description: "Summary of property activity by email",
  },
];

export default function NotificationSettingsScreen() {
  const { user, isAdmin, isOwner, updateProfile } = useAuth();
  const { maintenanceItems, documents, appliances, selectedProperty } = useHomeWise();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function rescheduleAll() {
    if (!user?.notificationsEnabled || !selectedProperty?.id) return;

    const pid = selectedProperty.id;
    const renewal = user.id ? await getSubscriptionRenewalDate(user.id) : null;

    await scheduleAllNotifications({
      maintenance: maintenanceItems.filter((m) => m.propertyId === pid),
      documents: documents.filter((d) => d.propertyId === pid),
      appliances: appliances.filter((a) => a.propertyId === pid),
      renewalDateIso: renewal,
      planLabel: displayPlanLabel(user.plan, { isAdmin, email: user.email, isOwner }),
      prefs: {
        maintenanceReminders: user.maintenanceReminders,
        warrantyAlerts: user.warrantyAlerts,
        applianceReminders: user.applianceReminders,
        subscriptionReminders: user.subscriptionReminders,
      },
    });
  }

  async function handleToggle(key: PrefKey, value: boolean) {
    if (saving) return;
    setSaving(true);

    if (key === "notificationsEnabled" && value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setSaving(false);
        Alert.alert(
          "Permission Required",
          "Enable notifications in your device settings to receive reminders."
        );
        return;
      }
      await registerPushToken().catch(() => {});
    }

    if (key === "notificationsEnabled" && !value) {
      await cancelAllNotifications();
      await unregisterPushTokens().catch(() => {});
    }

    const result = await updateProfile({ [key]: value });
    setSaving(false);

    if (result?.error) {
      Alert.alert("Save Failed", result.error);
      return;
    }

    if (key !== "emailDigest" && key !== "adminBroadcasts") {
      await rescheduleAll().catch(() => {});
    }
  }

  async function handleTestNotification() {
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Back</Text>
        </Pressable>

        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: 22,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 11,
              fontWeight: "900",
              letterSpacing: 1.2,
            }}
          >
            HOMEWISE
          </Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 6 }}>
            Notification Settings
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 8, fontSize: 14 }}>
            Control reminders and alerts for your home
          </Text>
        </View>

        <Card style={{ marginBottom: 14 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="notifications" size={22} color={colors.primary} />
                <Text style={styles.cardTitle}>Push Notifications</Text>
              </View>
              <Text style={[styles.muted, { marginTop: 6 }]}>
                Master switch for all HomeWise push notifications
              </Text>
            </View>
            <Switch
              value={user?.notificationsEnabled ?? true}
              onValueChange={(v) => handleToggle("notificationsEnabled", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              disabled={saving}
            />
          </View>
        </Card>

        <Text style={[styles.sectionHeader, { marginBottom: 10 }]}>Reminder Types</Text>

        {PREF_ROWS.map((row) => (
          <Card key={row.key} style={{ marginBottom: 10, opacity: user?.notificationsEnabled ? 1 : 0.55 }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name={row.icon as any} size={20} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{row.label}</Text>
                </View>
                <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>{row.description}</Text>
              </View>
              <Switch
                value={(user?.[row.key] as boolean) ?? true}
                onValueChange={(v) => handleToggle(row.key, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                disabled={saving || !user?.notificationsEnabled}
              />
            </View>
          </Card>
        ))}

        <Text style={[styles.sectionHeader, { marginTop: 8, marginBottom: 10 }]}>Actions</Text>

        <Pressable
          style={[styles.secondaryButton, testing && { opacity: 0.6 }]}
          onPress={handleTestNotification}
          disabled={testing}
        >
          <Ionicons name="paper-plane-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>
            {testing ? "Sending…" : "Send Test Notification"}
          </Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={openDeviceSettings}>
          <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Open Device Settings</Text>
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={() => router.push("/notifications")}>
          <Text style={styles.ghostButtonText}>View Notification Center</Text>
        </Pressable>

        <Card style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.muted, { flex: 1, lineHeight: 20 }]}>
              Reminders use Expo Notifications locally on your device. Admin broadcasts sync when
              you open the app. Push tokens are saved for future server-side delivery.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

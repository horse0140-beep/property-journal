import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  Switch,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardModal } from "@/components/KeyboardModal";
import { createSupportTicket } from "@/services/supportService";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { LoadingView } from "@/components/LoadingView";
import { colors, styles } from "@/constants/theme";
import { useTabScrollContentStyle } from "@/constants/layout";
import { TabScreenHeader } from "@/components/TabScreenHeader";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { cancelAllNotifications, requestNotificationPermission } from "@/lib/notifications";
import { supportsRemotePush } from "@/lib/expoRuntime";
import { registerPushToken, unregisterPushTokens } from "@/services/pushService";
import {
  isFounderAccount,
  FOUNDER_ACCOUNT_LABEL,
  OWNER_ACCESS_LABEL,
  SUPER_ADMIN_LABEL,
} from "@/lib/admin";

export default function ProfileScreen() {
  const { selectedProperty, properties, getPropertyScore, resetDemoData } = useHomeWise();
  const { user, isLoaded, signOut, updateProfile, updatePassword, isAdmin, isOwner } = useAuth();
  const tabScrollStyle = useTabScrollContentStyle();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [editName, setEditName] = useState(user?.name ?? "");
  const [editPhone, setEditPhone] = useState(user?.phone ?? "");
  const [editSaving, setEditSaving] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  const [showSupport, setShowSupport] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSaving, setSupportSaving] = useState(false);

  const score = selectedProperty ? getPropertyScore(selectedProperty.id) : null;

  useEffect(() => {
    setEditName(user?.name ?? "");
    setEditPhone(user?.phone ?? "");
  }, [user?.name, user?.phone]);

  async function handleEditProfile() {
    if (!editName.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }

    setEditSaving(true);

    const result = await updateProfile({
      name: editName.trim(),
      phone: editPhone.trim(),
    });

    setEditSaving(false);

    if (result?.error) {
      Alert.alert("Save Failed", result.error);
      return;
    }

    Alert.alert("Profile Saved", "Your name and phone number have been updated.");
    setShowEditProfile(false);
  }

  async function handleSubmitSupport() {
    if (!user?.email) return;
    if (!supportSubject.trim() || !supportMessage.trim()) {
      Alert.alert("Required", "Please enter a subject and message.");
      return;
    }

    setSupportSaving(true);
    try {
      await createSupportTicket({
        user_id: user.id,
        user_email: user.email,
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
        status: "open",
        priority: "normal",
      });
      setSupportSubject("");
      setSupportMessage("");
      setShowSupport(false);
      Alert.alert("Ticket Submitted", "Our support team will respond within 24 hours.");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not submit ticket.");
    } finally {
      setSupportSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwdError("");

    if (!currentPwd) {
      setPwdError("Enter your current password.");
      return;
    }

    if (newPwd.length < 8) {
      setPwdError("New password must be at least 8 characters.");
      return;
    }

    if (newPwd !== confirmPwd) {
      setPwdError("Passwords do not match.");
      return;
    }

    setPwdSaving(true);
    const result = await updatePassword(currentPwd, newPwd);
    setPwdSaving(false);

    if (result?.error) {
      setPwdError(result.error);
      return;
    }

    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setShowChangePassword(false);
    Alert.alert("Password Changed", "Your password has been updated successfully.");
  }

  async function handleNotificationToggle(
    key: "notificationsEnabled" | "maintenanceReminders" | "warrantyAlerts" | "emailDigest",
    value: boolean
  ) {
    if (key === "notificationsEnabled" && value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert("Permission Required", "Enable notifications in your device settings to receive reminders.");
        return;
      }
      if (user?.id && supportsRemotePush()) {
        await registerPushToken().catch(() => {});
      }
    }

    if (key === "notificationsEnabled" && !value) {
      await cancelAllNotifications();
      if (user?.id) {
        await unregisterPushTokens().catch(() => {});
      }
    }

    const result = await updateProfile({ [key]: value });
    if (result?.error) {
      Alert.alert("Save Failed", result.error);
    }
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const result = await signOut();
          if (result?.error) {
            Alert.alert("Sign Out Failed", result.error);
          }
        },
      },
    ]);
  }

  function confirmReset() {
    Alert.alert(
      "Refresh Cloud Data",
      "Reload your properties and home data from Supabase?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Refresh", onPress: resetDemoData },
      ]
    );
  }

  function showPremiumAlert() {
    Alert.alert(
      "Property Journal Premium",
      "Upgrade to Premium:\n\n• Property Sharing\n• Contractor Portal\n• Home Buyer Reports\n• AI Maintenance Forecasting\n• Stripe Billing\n• Unlimited properties & cloud sync\n\nStarting at $4.99/month",
      [
        { text: "Maybe Later", style: "cancel" },
        {
          text: "Learn More",
          onPress: () =>
            Alert.alert(
              "Property Journal Premium",
              "Premium features include:\n\n• Property Sharing\n• Contractor Portal\n• Home Buyer Reports\n• AI Maintenance Forecasting\n• Stripe Billing\n• Unlimited properties\n\nAvailable for $4.99/month or $39.99/year."
            ),
        },
      ]
    );
  }

  function Row({
    icon,
    label,
    value,
    onPress,
    destructive,
    toggle,
    toggleValue,
    onToggle,
  }: any) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress && !toggle}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: pressed && onPress ? colors.bgSection : "transparent",
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: destructive ? colors.dangerBg : colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? colors.danger : colors.primary}
          />
        </View>

        <Text
          style={{
            flex: 1,
            color: destructive ? colors.danger : colors.textPrimary,
            fontWeight: "600",
            fontSize: 15,
          }}
        >
          {label}
        </Text>

        {toggle && onToggle ? (
          <Switch
            value={toggleValue}
            onValueChange={onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        ) : value ? (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{value}</Text>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        ) : null}
      </Pressable>
    );
  }

  const planLabel: Record<string, string> = {
    free: "Free Plan",
    premium: "Premium",
    landlord: "Landlord Pro",
    realtor: "Realtor Pro",
  };

  if (!isLoaded) {
    return (
      <Screen noPad tabScreen>
        <LoadingView message="Loading profile…" />
      </Screen>
    );
  }

  return (
    <Screen noPad tabScreen>
      <TabScreenHeader>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.tabHeaderTitle}>Profile</Text>
          <Pressable
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.bgSection,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </TabScreenHeader>

      <ScrollView contentContainerStyle={tabScrollStyle}>
        {isOwner || isAdmin ? (
          <Pressable
            onPress={() => router.push("/admin")}
            style={{
              margin: 16,
              marginBottom: 0,
              backgroundColor: colors.primary,
              borderRadius: 16,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="shield-checkmark" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                Owner Dashboard
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 }}>
                Users, pricing, promo codes, subscriptions & reports
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : null}

        <View
          style={{
            padding: 24,
            backgroundColor: colors.bgCard,
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>
              {(user?.name ?? "U").charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>
            {user?.name ?? "Property Journal User"}
          </Text>

          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
            {user?.email}
          </Text>

          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            {user?.phone ? `Phone: ${user.phone}` : "Phone: Not added"}
          </Text>

          {isFounderAccount(user?.email) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {[FOUNDER_ACCOUNT_LABEL, OWNER_ACCESS_LABEL, SUPER_ADMIN_LABEL].map((label) => (
                <View
                  key={label}
                  style={{
                    backgroundColor: colors.gold,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : isOwner ? (
            <View
              style={{
                backgroundColor: colors.gold,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
                marginTop: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>
                {OWNER_ACCESS_LABEL}
              </Text>
            </View>
          ) : isAdmin ? (
            <View
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
                marginTop: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>
                SUPER ADMIN
              </Text>
            </View>
          ) : null}

          <View
            style={{
              backgroundColor: isOwner ? colors.primary : colors.bgSection,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
              marginTop: 8,
              borderWidth: isOwner ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: isOwner ? "#fff" : colors.primary,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {isOwner || user?.ownerAccess
                ? "Owner Access"
                : planLabel[user?.plan ?? "free"] ?? "Free Plan"}
            </Text>
          </View>

          {score && (
            <View
              style={{
                backgroundColor: colors.bgSection,
                borderRadius: 14,
                paddingHorizontal: 24,
                paddingVertical: 14,
                marginTop: 16,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                gap: 20,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>
                  HEALTH SCORE
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 30,
                    fontWeight: "900",
                    marginTop: 2,
                  }}
                >
                  {score.overall}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {score.label}
                </Text>
              </View>

              <View style={{ width: 1, height: 40, backgroundColor: colors.border }} />

              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>
                  PROPERTIES
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 30,
                    fontWeight: "900",
                    marginTop: 2,
                  }}
                >
                  {properties.length}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  tracked
                </Text>
              </View>
            </View>
          )}
        </View>

        {user?.plan === "free" && !isOwner && !isAdmin && (
        <Pressable
          onPress={() => router.push("/subscriptions")}
          style={{
            margin: 16,
            backgroundColor: colors.primary,
              borderRadius: 16,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="star" size={22} color={colors.gold} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                Upgrade to Premium
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                PDF reports, buyer links, cloud sync & more
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}

        {selectedProperty && (
          <Card style={{ marginHorizontal: 16 }}>
            <Text style={styles.cardSubtitle}>ACTIVE PROPERTY</Text>
            <Text style={styles.cardTitle}>{selectedProperty.address}</Text>
            <Text style={styles.muted}>
              {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
            </Text>

            <View style={styles.divider} />

            <View style={{ flexDirection: "row", gap: 16 }}>
              {[
                { label: "Built", value: selectedProperty.yearBuilt || "—" },
                { label: "Sq Ft", value: selectedProperty.squareFeet || "—" },
                {
                  label: "Value",
                  value: selectedProperty.estimatedValue
                    ? `$${selectedProperty.estimatedValue}`
                    : "—",
                },
              ].map((i) => (
                <View key={i.label}>
                  <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>
                    {i.label}
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 13 }}>
                    {i.value}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[styles.secondaryButton, { marginTop: 12 }]}
              onPress={() => router.push("/properties")}
            >
              <Text style={styles.secondaryButtonText}>
                Manage Properties ({properties.length})
              </Text>
            </Pressable>
          </Card>
        )}

        {isAdmin && (
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
              ADMIN
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
              <Row
                icon="shield-checkmark-outline"
                label="Admin Dashboard"
                onPress={() => router.push("/admin")}
              />
              <Row
                icon="pricetag-outline"
                label="Pricing Management"
                onPress={() => router.push("/admin/pricing")}
              />
              <Row
                icon="ticket-outline"
                label="Promo Codes"
                onPress={() => router.push("/admin/promo-codes")}
              />
              <Row
                icon="people-outline"
                label="User Management"
                onPress={() => router.push("/admin/users")}
              />
              <Row
                icon="card-outline"
                label="Subscription Management"
                onPress={() => router.push("/admin/subscriptions")}
              />
              <Row
                icon="chatbubble-ellipses-outline"
                label="Support Tickets"
                onPress={() => router.push("/admin/support")}
              />
              <Row
                icon="bar-chart-outline"
                label="Reports & Analytics"
                onPress={() => router.push("/admin/reports")}
              />
            </View>
          </View>
        )}

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
            ACCOUNT
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
            <Row
              icon="star-outline"
              label="Premium Features"
              onPress={() => router.push("/features")}
            />
            <Row
              icon="settings-outline"
              label="Settings"
              onPress={() => router.push("/settings")}
            />
            <Row
              icon="person-outline"
              label="Edit Profile"
              onPress={() => {
                setEditName(user?.name ?? "");
                setEditPhone(user?.phone ?? "");
                setShowEditProfile(true);
              }}
            />
            <Row
              icon="lock-closed-outline"
              label="Change Password"
              onPress={() => {
                setCurrentPwd("");
                setNewPwd("");
                setConfirmPwd("");
                setPwdError("");
                setShowChangePassword(true);
              }}
            />
            <Row icon="mail-outline" label="Email" value={user?.email ?? ""} />
            <Row icon="call-outline" label="Phone" value={user?.phone || "Not added"} />
          </View>
        </View>

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
            NOTIFICATIONS
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
            <Row
              icon="notifications-outline"
              label="Push Notifications"
              toggle
              toggleValue={user?.notificationsEnabled ?? true}
              onToggle={(v: boolean) => handleNotificationToggle("notificationsEnabled", v)}
            />
            <Row
              icon="construct-outline"
              label="Maintenance Reminders"
              toggle
              toggleValue={user?.maintenanceReminders ?? true}
              onToggle={(v: boolean) => handleNotificationToggle("maintenanceReminders", v)}
            />
            <Row
              icon="shield-outline"
              label="Warranty Expiration Alerts"
              toggle
              toggleValue={user?.warrantyAlerts ?? true}
              onToggle={(v: boolean) => handleNotificationToggle("warrantyAlerts", v)}
            />
            <Row
              icon="mail-outline"
              label="Weekly Email Digest"
              toggle
              toggleValue={user?.emailDigest ?? false}
              onToggle={(v: boolean) => handleNotificationToggle("emailDigest", v)}
            />
          </View>
        </View>

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
            HELP & SUPPORT
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
            <Row
              icon="chatbubble-ellipses-outline"
              label="Submit Support Ticket"
              onPress={() => setShowSupport(true)}
            />
            <Row
              icon="help-circle-outline"
              label="Help Center"
              onPress={() =>
                Alert.alert(
                  "Help Center",
                  "For help and support, email us at:\n\nsupport@homewise.app\n\nWe typically respond within 24 hours."
                )
              }
            />
            <Row
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => router.push("/legal/terms")}
            />
            <Row
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              onPress={() => router.push("/legal/privacy")}
            />
            <Row
              icon="star-outline"
              label="Rate Property Journal"
              onPress={() =>
                Alert.alert("Rate Property Journal", "Thank you! Tap OK when our App Store page opens.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "OK" },
                ])
              }
            />
            <Row
              icon="chatbubble-outline"
              label="Send Feedback"
              onPress={() =>
                Linking.openURL("mailto:feedback@homewise.app?subject=Property%20Journal%20Feedback")
              }
            />
          </View>
        </View>

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
            APP
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
            <Row icon="information-circle-outline" label="Version" value="2.0.0 (Build 1)" />
            <Row
              icon="refresh-outline"
              label="Refresh Cloud Data"
              onPress={confirmReset}
            />
          </View>
        </View>

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
            DANGER ZONE
          </Text>
          {!isFounderAccount(user?.email) && (
          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.danger,
            }}
          >
            <Row
              icon="trash-outline"
              label="Delete Account"
              destructive
              onPress={() => router.push("/account/delete")}
            />
          </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Pressable
            onPress={handleSignOut}
            style={[styles.secondaryButton, { borderColor: colors.danger }]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
              Sign Out
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            color: colors.textMuted,
            textAlign: "center",
            fontSize: 12,
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          Property Journal™ — The CarFax for Your House{"\n"}© 2026 Property Journal
        </Text>
      </ScrollView>

      <KeyboardModal visible={showEditProfile} onRequestClose={() => setShowEditProfile(false)}>
            <View style={styles.modalHandle} />

            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setShowEditProfile(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="555-555-5555"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />

            <Pressable
              style={[styles.primaryButton, editSaving && { opacity: 0.7 }]}
              onPress={handleEditProfile}
              disabled={editSaving}
            >
              {editSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              )}
            </Pressable>

            <Pressable style={styles.ghostButton} onPress={() => setShowEditProfile(false)}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
      </KeyboardModal>

      <KeyboardModal visible={showChangePassword} onRequestClose={() => setShowChangePassword(false)}>
            <View style={styles.modalHandle} />

            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable onPress={() => setShowChangePassword(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {pwdError ? (
              <View
                style={{
                  backgroundColor: colors.dangerBg,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>
                  {pwdError}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPwd}
              onChangeText={setCurrentPwd}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPwd}
              onChangeText={setNewPwd}
              secureTextEntry
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              secureTextEntry
              placeholder="Repeat new password"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable
              style={[styles.primaryButton, pwdSaving && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={pwdSaving}
            >
              {pwdSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Update Password</Text>
              )}
            </Pressable>

            <Pressable style={styles.ghostButton} onPress={() => setShowChangePassword(false)}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
      </KeyboardModal>

      <KeyboardModal visible={showSupport} onRequestClose={() => setShowSupport(false)}>
            <View style={styles.modalHandle} />
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Support Ticket</Text>
              <Pressable onPress={() => setShowSupport(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={supportSubject}
              onChangeText={setSupportSubject}
              placeholder="Brief summary"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="Describe your issue"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Pressable
              style={[styles.primaryButton, supportSaving && { opacity: 0.7 }]}
              onPress={handleSubmitSupport}
              disabled={supportSaving}
            >
              {supportSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Submit Ticket</Text>
              )}
            </Pressable>
      </KeyboardModal>
    </Screen>
  );
}
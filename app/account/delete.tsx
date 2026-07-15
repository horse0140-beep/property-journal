import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { isFounderAccount, PROTECTED_ACCOUNT_MESSAGE } from "@/lib/admin";
import { cancelAllNotifications } from "@/lib/notifications";
import { unregisterPushTokens } from "@/services/pushService";
import { colors, styles } from "@/constants/theme";

const CONFIRM_TEXT = "DELETE";

const DATA_REMOVED = [
  "Your profile and account settings",
  "All properties and home health scores",
  "Maintenance, repairs, and appliances",
  "Documents, receipts, warranties, and photos",
  "Subscriptions and support tickets",
];

export default function DeleteAccountScreen() {
  const { user, isLoaded, isSignedIn, deleteAccount } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/auth/sign-in");
    }
  }, [isLoaded, isSignedIn]);

  const canProceed = confirmText.trim().toUpperCase() === CONFIRM_TEXT;

  function openFinalConfirmation() {
    setError("");
    if (!canProceed) {
      setError(`Type ${CONFIRM_TEXT} to confirm account deletion.`);
      return;
    }
    setShowFinalModal(true);
  }

  async function handleDelete() {
    if (!user?.id) return;

    setDeleting(true);
    setError("");

    try {
      await cancelAllNotifications();
      await unregisterPushTokens().catch(() => {});

      const result = await deleteAccount();

      if (result.error) {
        setError(result.error);
        setShowFinalModal(false);
        return;
      }

      setShowFinalModal(false);
      router.replace("/auth/sign-in");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete account.");
      setShowFinalModal(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!isLoaded || !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isFounderAccount(user.email)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
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
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>Delete Account</Text>
        </View>
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" }}>
            Protected Account
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 12, lineHeight: 22 }}>
            {PROTECTED_ACCOUNT_MESSAGE}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
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
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>Delete Account</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: colors.dangerBg,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.danger,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Ionicons name="warning" size={28} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.danger, fontSize: 18, fontWeight: "900", marginBottom: 8 }}>
                This action is permanent
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 22, fontSize: 14 }}>
                Deleting your HomeWise account will permanently remove all of your data from our servers.
                This cannot be undone.
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 20,
          }}
        >
          <Text style={styles.sectionHeader}>What will be deleted</Text>
          {DATA_REMOVED.map((item) => (
            <View key={item} style={{ flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
              <Ionicons name="close-circle" size={18} color={colors.danger} style={{ marginTop: 1 }} />
              <Text style={[styles.bodyText, { flex: 1 }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 20,
          }}
        >
          <Text style={styles.label}>Signed in as</Text>
          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
            {user.name}
          </Text>
          <Text style={styles.muted}>{user.email}</Text>
        </View>

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

        <Text style={styles.label}>
          Type <Text style={{ fontWeight: "900", color: colors.danger }}>{CONFIRM_TEXT}</Text> to confirm
        </Text>
        <TextInput
          style={[
            styles.input,
            canProceed ? { borderColor: colors.danger } : null,
          ]}
          placeholder={CONFIRM_TEXT}
          placeholderTextColor={colors.textMuted}
          value={confirmText}
          onChangeText={(v) => {
            setConfirmText(v);
            setError("");
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!deleting}
        />

        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.danger, marginTop: 20 },
            (!canProceed || deleting) && { opacity: 0.5 },
          ]}
          onPress={openFinalConfirmation}
          disabled={!canProceed || deleting}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Delete My Account</Text>
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={() => router.back()} disabled={deleting}>
          <Text style={styles.ghostButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showFinalModal} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15,31,61,0.55)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: colors.danger,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.dangerBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash" size={28} color={colors.danger} />
              </View>
            </View>

            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: "900",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Final confirmation
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 20 }}>
              Are you absolutely sure? Your account{" "}
              <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{user.email}</Text> and all
              associated HomeWise data will be permanently deleted.
            </Text>

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: colors.danger },
                deleting && { opacity: 0.7 },
              ]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryButtonText}>Deleting…</Text>
                </>
              ) : (
                <Text style={styles.primaryButtonText}>Yes, Delete Forever</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.ghostButton}
              onPress={() => !deleting && setShowFinalModal(false)}
              disabled={deleting}
            >
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminErrorCard } from "@/components/admin/AdminErrorCard";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  deactivateBroadcast,
  fetchAllBroadcastsAdmin,
  sendAdminBroadcast,
} from "@/services/notificationService";
import type { AdminBroadcast } from "@/types/notifications";

export default function AdminBroadcastScreen() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setBroadcasts(await fetchAllBroadcastsAdmin());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load broadcasts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Validation", "Title and message are required.");
      return;
    }
    if (!user?.id) return;

    Alert.alert("Send Broadcast", "Send this notification to all Property Journal users?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: async () => {
          setSending(true);
          try {
            await sendAdminBroadcast({ title: title.trim(), body: body.trim() }, user.id);
            setTitle("");
            setBody("");
            await load();
            Alert.alert("Sent", "Broadcast published. Users will see it in their Notification Center.");
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to send broadcast");
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  }

  function confirmDeactivate(broadcast: AdminBroadcast) {
    Alert.alert("Deactivate", `Remove "${broadcast.title}" from active broadcasts?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          try {
            await deactivateBroadcast(broadcast.id);
            await load();
          } catch (e: unknown) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to deactivate");
          }
        },
      },
    ]);
  }

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader
          title="Broadcast Notifications"
          subtitle="Send announcements to all users"
        />

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
          >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          >
            {error ? <AdminErrorCard message={error} onRetry={load} /> : null}

            <Card>
              <Text style={styles.sectionHeader}>New Broadcast</Text>
              <TextInput
                style={styles.input}
                placeholder="Title"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
                placeholder="Message to all users"
                placeholderTextColor={colors.textMuted}
                value={body}
                onChangeText={setBody}
                multiline
              />
              <Pressable
                style={[styles.primaryButton, sending && { opacity: 0.7 }]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="megaphone-outline" size={18} color="#fff" />
                )}
                <Text style={styles.primaryButtonText}>Send Broadcast</Text>
              </Pressable>
            </Card>

            <Text style={[styles.sectionHeader, { marginTop: 8 }]}>Recent Broadcasts</Text>

            {broadcasts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="megaphone-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No broadcasts yet</Text>
                <Text style={styles.emptyStateText}>
                  Send your first announcement to all Property Journal users.
                </Text>
              </View>
            ) : (
              broadcasts.map((b) => (
                <Card key={b.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{b.title}</Text>
                    <AdminBadge
                      label={b.is_active ? "Active" : "Inactive"}
                      variant={b.is_active ? "success" : "muted"}
                    />
                  </View>
                  <Text style={styles.muted}>{b.body}</Text>
                  <Text style={[styles.muted, { fontSize: 11, marginTop: 8 }]}>
                    {new Date(b.created_at).toLocaleString()}
                  </Text>
                  {b.is_active && (
                    <Pressable
                      onPress={() => confirmDeactivate(b)}
                      style={[
                        styles.secondaryButton,
                        { marginTop: 12, borderColor: colors.danger },
                      ]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
                        Deactivate
                      </Text>
                    </Pressable>
                  )}
                </Card>
              ))
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Screen>
    </AdminGate>
  );
}

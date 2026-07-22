import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { LoadingView } from "@/components/LoadingView";
import { EmptyState } from "@/components/EmptyState";
import { BackLink } from "@/components/EmptyState";
import { goBackOrHome } from "@/components/WebHomeButton";
import { colors, styles, hitSlopDefault } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  getInboxNotifications,
  markAllNotificationsRead,
  markBroadcastRead,
  markNotificationRead,
  NOTIFICATION_TYPE_META,
  syncBroadcastsToInbox,
} from "@/services/notificationService";
import type { InboxNotification } from "@/types/notifications";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 48) return "Yesterday";
  return d.toLocaleDateString();
}

function navigateForType(type: string) {
  switch (type) {
    case "maintenance":
      router.push("/(tabs)/maintenance");
      break;
    case "warranty":
      router.push("/(tabs)/vault");
      break;
    case "appliance":
      router.push("/(tabs)/maintenance");
      break;
    case "subscription":
      router.push("/subscriptions");
      break;
    case "broadcast":
    case "system":
    default:
      break;
  }
}

export default function NotificationCenterScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      if (user?.id) {
        await syncBroadcastsToInbox(user.id, user.adminBroadcasts ?? true);
      }
      setItems(await getInboxNotifications());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.adminBroadcasts]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function handleOpen(item: InboxNotification) {
    await markNotificationRead(item.id);
    if (item.broadcastId && user?.id) {
      await markBroadcastRead(user.id, item.broadcastId);
    }
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    navigateForType(item.type);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unread = items.filter((n) => !n.read).length;

  if (loading && items.length === 0) {
    return (
      <Screen>
        <LoadingView message="Loading notifications…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <BackLink onPress={goBackOrHome} />

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
            PROPERTY JOURNAL
          </Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 6 }}>
            Notification Center
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 8, fontSize: 14 }}>
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </Text>
        </View>

        <View style={[styles.rowBetween, { marginBottom: 12 }]}>
          <Pressable
            onPress={() => router.push("/notifications/settings")}
            hitSlop={hitSlopDefault}
            accessibilityRole="button"
            accessibilityLabel="Notification settings"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Settings</Text>
            </View>
          </Pressable>
          {unread > 0 ? (
            <Pressable
              onPress={handleMarkAllRead}
              hitSlop={hitSlopDefault}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
            >
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <Card style={{ backgroundColor: colors.dangerBg, borderColor: colors.danger, marginBottom: 14 }}>
            <Text style={{ color: colors.danger, fontWeight: "600" }}>{error}</Text>
            <Pressable onPress={load} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.danger, fontWeight: "800" }}>Tap to retry</Text>
            </Pressable>
          </Card>
        ) : null}

        {refreshing && (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />
        )}

        {items.length === 0 && !error ? (
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications yet"
            message="Maintenance reminders, warranty alerts, and subscription updates will appear here."
            actionLabel="Notification Settings"
            onAction={() => router.push("/notifications/settings")}
          />
        ) : (
          items.map((item) => {
            const meta = NOTIFICATION_TYPE_META[item.type] ?? NOTIFICATION_TYPE_META.system;
            return (
              <Pressable key={item.id} onPress={() => handleOpen(item)}>
                <Card
                  style={{
                    marginBottom: 10,
                    borderColor: item.read ? colors.border : colors.primary,
                    borderWidth: item.read ? 1 : 1.5,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: colors.bgSection,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={meta.icon as any} size={22} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>
                          {meta.label.toUpperCase()}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                          {formatTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: item.read ? "600" : "800",
                          fontSize: 15,
                          marginTop: 2,
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.muted, { marginTop: 4, lineHeight: 20 }]} numberOfLines={3}>
                        {item.body}
                      </Text>
                    </View>
                    {!item.read ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.primary,
                          marginTop: 6,
                        }}
                      />
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

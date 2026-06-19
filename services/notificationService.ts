import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import type {
  AdminBroadcast,
  AdminBroadcastInput,
  InboxNotification,
  NotificationType,
} from "@/types/notifications";

const INBOX_KEY = "homewise_notification_inbox_v1";
const MAX_INBOX = 100;

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("42p01")
  );
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function readInbox(): Promise<InboxNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(INBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboxNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeInbox(items: InboxNotification[]): Promise<void> {
  await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(items.slice(0, MAX_INBOX)));
}

export async function getInboxNotifications(): Promise<InboxNotification[]> {
  const items = await readInbox();
  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getUnreadCount(): Promise<number> {
  const items = await readInbox();
  return items.filter((n) => !n.read).length;
}

export async function saveIncomingNotification(input: {
  type: NotificationType;
  title: string;
  body: string;
  sourceId?: string;
  broadcastId?: string;
}): Promise<InboxNotification> {
  const items = await readInbox();
  const entry: InboxNotification = {
    id: uuid(),
    type: input.type,
    title: input.title,
    body: input.body,
    createdAt: new Date().toISOString(),
    read: false,
    sourceId: input.sourceId,
    broadcastId: input.broadcastId,
  };

  const exists = items.some(
    (n) =>
      n.broadcastId &&
      input.broadcastId &&
      n.broadcastId === input.broadcastId
  );
  if (exists) return entry;

  items.unshift(entry);
  await writeInbox(items);
  return entry;
}

export async function markNotificationRead(id: string): Promise<void> {
  const items = await readInbox();
  const updated = items.map((n) => (n.id === id ? { ...n, read: true } : n));
  await writeInbox(updated);
}

export async function markAllNotificationsRead(): Promise<void> {
  const items = await readInbox();
  await writeInbox(items.map((n) => ({ ...n, read: true })));
}

export async function clearInbox(): Promise<void> {
  await AsyncStorage.removeItem(INBOX_KEY);
}

export async function fetchAdminBroadcasts(): Promise<AdminBroadcast[]> {
  const { data, error } = await supabase
    .from("notification_broadcasts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingTableError(error.message)) return [];
    console.warn("fetchAdminBroadcasts:", error.message);
    return [];
  }

  return (data ?? []) as AdminBroadcast[];
}

export async function syncBroadcastsToInbox(
  userId: string,
  adminBroadcastsEnabled = true
): Promise<number> {
  if (!adminBroadcastsEnabled) return 0;

  const broadcasts = await fetchAdminBroadcasts();
  if (!broadcasts.length) return 0;

  let added = 0;

  for (const broadcast of broadcasts) {
    const { data: readRow } = await supabase
      .from("user_broadcast_reads")
      .select("broadcast_id")
      .eq("user_id", userId)
      .eq("broadcast_id", broadcast.id)
      .maybeSingle();

    if (readRow) continue;

    await saveIncomingNotification({
      type: "broadcast",
      title: broadcast.title,
      body: broadcast.body,
      broadcastId: broadcast.id,
    });

    if (Platform.OS !== "web") {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `📢 ${broadcast.title}`,
            body: broadcast.body,
            data: { type: "broadcast", id: broadcast.id },
            sound: true,
          },
          trigger: { seconds: 2 } as Notifications.NotificationTriggerInput,
        });
      } catch {
        // Non-fatal
      }
    }

    added++;
  }

  return added;
}

export async function markBroadcastRead(
  userId: string,
  broadcastId: string
): Promise<void> {
  const { error } = await supabase.from("user_broadcast_reads").upsert(
    { user_id: userId, broadcast_id: broadcastId },
    { onConflict: "user_id,broadcast_id" }
  );

  if (error && !isMissingTableError(error.message)) {
    console.warn("markBroadcastRead:", error.message);
  }
}

export async function sendAdminBroadcast(
  input: AdminBroadcastInput,
  sentBy: string
): Promise<AdminBroadcast> {
  const { data, error } = await supabase
    .from("notification_broadcasts")
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      sent_by: sentBy,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as AdminBroadcast;
}

export async function deactivateBroadcast(id: string): Promise<void> {
  const { error } = await supabase
    .from("notification_broadcasts")
    .update({ is_active: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function fetchAllBroadcastsAdmin(): Promise<AdminBroadcast[]> {
  const { data, error } = await supabase
    .from("notification_broadcasts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? []) as AdminBroadcast[];
}

export async function getSubscriptionRenewalDate(
  userId: string
): Promise<string | null> {
  const { data: stripe, error: stripeError } = await supabase
    .from("stripe_customers")
    .select("current_period_end, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!stripeError && stripe?.current_period_end && stripe.status === "active") {
    return stripe.current_period_end as string;
  }

  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("expires_at, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subError && sub?.expires_at) {
    return sub.expires_at as string;
  }

  return null;
}

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; icon: string; color: string }
> = {
  maintenance: { label: "Maintenance", icon: "construct-outline", color: "#1A3C8F" },
  warranty: { label: "Warranty", icon: "shield-outline", color: "#16A34A" },
  appliance: { label: "Appliance", icon: "hardware-chip-outline", color: "#D97706" },
  subscription: { label: "Subscription", icon: "card-outline", color: "#0284C7" },
  broadcast: { label: "Announcement", icon: "megaphone-outline", color: "#F59E0B" },
  system: { label: "System", icon: "information-circle-outline", color: "#8A9AB8" },
};

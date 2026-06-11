import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { MaintenanceItem, Document } from "@/data/demoData";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleMaintenanceNotifications(
  items: MaintenanceItem[]
): Promise<void> {
  if (Platform.OS === "web") return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  // Cancel existing maintenance notifications
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === "maintenance") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const now = Date.now();

  for (const item of items) {
    if (item.status === "Completed") continue;

    // Schedule 3 days before if we can parse the date
    const triggerDate = parseDueDate(item.nextDue);
    if (!triggerDate) continue;

    const reminderTime = triggerDate.getTime() - 3 * 24 * 60 * 60 * 1000;
    if (reminderTime <= now) {
      // Already past — schedule immediate if overdue
      if (item.status === "Overdue") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ Overdue Maintenance",
            body: `${item.title} is overdue. Tap to mark complete.`,
            data: { type: "maintenance", id: item.id },
            sound: true,
          },
          trigger: { seconds: 5 } as any,
        });
      }
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔧 Maintenance Reminder",
        body: `${item.title} is due in 3 days.`,
        data: { type: "maintenance", id: item.id },
        sound: true,
      },
      trigger: { date: new Date(reminderTime) } as any,
    });
  }
}

export async function scheduleWarrantyNotifications(
  documents: Document[]
): Promise<void> {
  if (Platform.OS === "web") return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === "warranty") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const now = Date.now();

  for (const doc of documents) {
    if (doc.category !== "warranty" || !doc.expiresDate) continue;

    const expiry = parseDueDate(doc.expiresDate);
    if (!expiry) continue;

    // 30-day warning
    const thirtyDayWarning = expiry.getTime() - 30 * 24 * 60 * 60 * 1000;
    if (thirtyDayWarning > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🛡️ Warranty Expiring Soon",
          body: `${doc.title} expires in 30 days. Tap to review.`,
          data: { type: "warranty", id: doc.id },
          sound: true,
        },
        trigger: { date: new Date(thirtyDayWarning) } as any,
      });
    }

    // 7-day warning
    const sevenDayWarning = expiry.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (sevenDayWarning > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ Warranty Expiring in 7 Days",
          body: `${doc.title} expires soon. Renew now.`,
          data: { type: "warranty", id: doc.id },
          sound: true,
        },
        trigger: { date: new Date(sevenDayWarning) } as any,
      });
    }
  }
}

function parseDueDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "TBD" || dateStr === "Not yet") return null;

  // Try direct parse
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Try "Month YYYY" format
  const monthYear = dateStr.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const parsed = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // Try "Month Day, YYYY"
  const full = dateStr.match(/^([A-Za-z]+)\s+(\d+),?\s+(\d{4})$/);
  if (full) {
    const parsed = new Date(`${full[1]} ${full[2]}, ${full[3]}`);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

export function setupNotificationListeners(
  onNotification: (data: { type: string; id: string }) => void
) {
  const sub1 = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as any;
    if (data?.type && data?.id) onNotification(data);
  });

  const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;
    if (data?.type && data?.id) onNotification(data);
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}

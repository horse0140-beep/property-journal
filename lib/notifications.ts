import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Appliance, Document, MaintenanceItem } from "@/data/demoData";
import { saveIncomingNotification } from "@/services/notificationService";
import type { NotificationType } from "@/types/notifications";
import { supportsLocalNotifications } from "@/lib/expoRuntime";
import { normalizeDateForDatabase } from "@/lib/dateForDatabase";

if (supportsLocalNotifications()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Android requires the channel referenced by app.json's defaultChannel to
  // exist, or pushes fall back to a low-importance "Miscellaneous" channel.
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("maintenance", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {});
  }
}

/** SDK 54 trigger builders — legacy `{seconds}` / `{date}` shapes throw. */
function dateTrigger(date: Date): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
}

function secondsTrigger(seconds: number): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds };
}

/**
 * Immediate "overdue"/"replace soon" pings fire at most once per day so
 * reopening the app doesn't re-notify the user about the same item.
 */
async function shouldSendImmediatePing(kind: string): Promise<boolean> {
  const key = `HOMEWISE_IMMEDIATE_PING_${kind}`;
  const today = new Date().toDateString();
  try {
    const last = await AsyncStorage.getItem(key);
    if (last === today) return false;
    await AsyncStorage.setItem(key, today);
    return true;
  } catch {
    return false;
  }
}

export type NotificationSchedulePrefs = {
  maintenanceReminders?: boolean;
  warrantyAlerts?: boolean;
  applianceReminders?: boolean;
  subscriptionReminders?: boolean;
};

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supportsLocalNotifications()) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function cancelAllNotifications(): Promise<void> {
  if (!supportsLocalNotifications()) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

async function cancelNotificationsByType(type: NotificationType): Promise<void> {
  if (!supportsLocalNotifications()) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as { type?: string })?.type === type) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function scheduleMaintenanceNotifications(
  items: MaintenanceItem[]
): Promise<void> {
  if (Platform.OS === "web") return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  await cancelNotificationsByType("maintenance");

  const now = Date.now();

  for (const item of items) {
    if (item.status === "Completed") continue;

    const triggerDate = parseDueDate(item.nextDue);
    if (!triggerDate) continue;

    const reminderTime = triggerDate.getTime() - 3 * 24 * 60 * 60 * 1000;

    if (reminderTime <= now) {
      if (item.status === "Overdue" && (await shouldSendImmediatePing("maintenance"))) {
        await scheduleLocal({
          type: "maintenance",
          title: "Overdue Maintenance",
          body: `${item.title} is overdue. Tap to mark complete.`,
          sourceId: item.id,
          trigger: secondsTrigger(5),
        });
      }
      continue;
    }

    await scheduleLocal({
      type: "maintenance",
      title: "Maintenance Reminder",
      body: `${item.title} is due in 3 days.`,
      sourceId: item.id,
      trigger: dateTrigger(new Date(reminderTime)),
    });
  }
}

export async function scheduleWarrantyNotifications(
  documents: Document[]
): Promise<void> {
  if (Platform.OS === "web") return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  await cancelNotificationsByType("warranty");

  const now = Date.now();

  for (const doc of documents) {
    if (doc.category !== "warranty" || !doc.expiresDate) continue;

    const expiry = parseDueDate(doc.expiresDate);
    if (!expiry) continue;

    const thirtyDayWarning = expiry.getTime() - 30 * 24 * 60 * 60 * 1000;
    if (thirtyDayWarning > now) {
      await scheduleLocal({
        type: "warranty",
        title: "Warranty Expiring Soon",
        body: `${doc.title} expires in 30 days. Tap to review.`,
        sourceId: doc.id,
        trigger: dateTrigger(new Date(thirtyDayWarning)),
      });
    }

    const sevenDayWarning = expiry.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (sevenDayWarning > now) {
      await scheduleLocal({
        type: "warranty",
        title: "Warranty Expiring in 7 Days",
        body: `${doc.title} expires soon. Renew now.`,
        sourceId: doc.id,
        trigger: dateTrigger(new Date(sevenDayWarning)),
      });
    }
  }
}

export async function scheduleApplianceNotifications(
  appliances: Appliance[]
): Promise<void> {
  if (Platform.OS === "web") return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  await cancelNotificationsByType("appliance");

  const now = Date.now();

  for (const appliance of appliances) {
    const replacementDate = getApplianceReplacementDate(appliance);
    if (!replacementDate) continue;

    const thirtyDayWarning = replacementDate.getTime() - 30 * 24 * 60 * 60 * 1000;
    if (thirtyDayWarning > now) {
      await scheduleLocal({
        type: "appliance",
        title: "Appliance Replacement Reminder",
        body: `${appliance.name} may need replacement in 30 days.`,
        sourceId: appliance.id,
        trigger: dateTrigger(new Date(thirtyDayWarning)),
      });
    }

    const sevenDayWarning = replacementDate.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (sevenDayWarning > now) {
      await scheduleLocal({
        type: "appliance",
        title: "Appliance Replacement Soon",
        body: `${appliance.name} is nearing end of life. Plan a replacement.`,
        sourceId: appliance.id,
        trigger: dateTrigger(new Date(sevenDayWarning)),
      });
    }

    if (
      appliance.condition === "Replace Soon" &&
      replacementDate.getTime() <= now + 14 * 24 * 60 * 60 * 1000 &&
      (await shouldSendImmediatePing("appliance"))
    ) {
      await scheduleLocal({
        type: "appliance",
        title: "Replace Appliance",
        body: `${appliance.name} is marked Replace Soon.`,
        sourceId: appliance.id,
        trigger: secondsTrigger(10),
      });
    }
  }
}

export async function scheduleSubscriptionRenewalNotifications(
  renewalDateIso: string | null,
  planLabel: string
): Promise<void> {
  if (Platform.OS === "web") return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  await cancelNotificationsByType("subscription");

  const renewal = renewalDateIso ? new Date(renewalDateIso) : null;
  const now = Date.now();

  if (renewal && !isNaN(renewal.getTime())) {
    const sevenDayWarning = renewal.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (sevenDayWarning > now) {
      await scheduleLocal({
        type: "subscription",
        title: "Subscription Renewal Reminder",
        body: `Your ${planLabel} plan renews in 7 days.`,
        trigger: dateTrigger(new Date(sevenDayWarning)),
      });
    }

    const oneDayWarning = renewal.getTime() - 24 * 60 * 60 * 1000;
    if (oneDayWarning > now) {
      await scheduleLocal({
        type: "subscription",
        title: "Subscription Renews Tomorrow",
        body: `Your ${planLabel} subscription renews tomorrow.`,
        trigger: dateTrigger(new Date(oneDayWarning)),
      });
    }
    return;
  }

  // Fallback: monthly reminder for paid plans without a known date
  if (planLabel !== "Free") {
    const fallback = new Date(now + 25 * 24 * 60 * 60 * 1000);
    await scheduleLocal({
      type: "subscription",
      title: "Subscription Reminder",
      body: `Review your ${planLabel} subscription and billing details.`,
      trigger: dateTrigger(fallback),
    });
  }
}

export async function scheduleAllNotifications(input: {
  maintenance: MaintenanceItem[];
  documents: Document[];
  appliances: Appliance[];
  renewalDateIso: string | null;
  planLabel: string;
  prefs: NotificationSchedulePrefs;
}): Promise<void> {
  if (Platform.OS === "web") return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  if (input.prefs.maintenanceReminders !== false) {
    await scheduleMaintenanceNotifications(input.maintenance);
  } else {
    await cancelNotificationsByType("maintenance");
  }

  if (input.prefs.warrantyAlerts !== false) {
    await scheduleWarrantyNotifications(input.documents);
  } else {
    await cancelNotificationsByType("warranty");
  }

  if (input.prefs.applianceReminders !== false) {
    await scheduleApplianceNotifications(input.appliances);
  } else {
    await cancelNotificationsByType("appliance");
  }

  if (input.prefs.subscriptionReminders !== false) {
    await scheduleSubscriptionRenewalNotifications(input.renewalDateIso, input.planLabel);
  } else {
    await cancelNotificationsByType("subscription");
  }
}

export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "HomeWise Test Notification",
      body: "Push notifications are working correctly.",
      data: { type: "system", id: "test" },
      sound: true,
    },
    trigger: secondsTrigger(2),
  });

  await saveIncomingNotification({
    type: "system",
    title: "HomeWise Test Notification",
    body: "Push notifications are working correctly.",
    sourceId: "test",
  });

  return true;
}

function getApplianceReplacementDate(appliance: Appliance): Date | null {
  if (appliance.condition === "Replace Soon") {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const install = parseDueDate(appliance.installDate);
  if (!install || appliance.expectedLifeYears <= 0) return null;

  const replace = new Date(install);
  replace.setFullYear(replace.getFullYear() + appliance.expectedLifeYears);
  return replace;
}

async function scheduleLocal(input: {
  type: NotificationType;
  title: string;
  body: string;
  sourceId?: string;
  trigger: Notifications.NotificationTriggerInput;
}): Promise<void> {
  const icon =
    input.type === "maintenance"
      ? "🔧"
      : input.type === "warranty"
        ? "🛡️"
        : input.type === "appliance"
          ? "⚙️"
          : input.type === "subscription"
            ? "💳"
            : "📢";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${icon} ${input.title}`,
      body: input.body,
      data: { type: input.type, id: input.sourceId ?? "" },
      sound: true,
    },
    trigger: input.trigger,
  });
}

/**
 * Parse a stored or display date ("2026-07-01", "July 2026", "Jul 15, 2026",
 * "TBD"…) into a local Date, constructed numerically so it never depends on
 * engine-specific Date.parse behavior (Hermes-safe).
 */
export function parseDueDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const result = normalizeDateForDatabase(dateStr);
  if (!result.ok || !result.iso) return null;

  const [year, month, day] = result.iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function setupNotificationListeners(
  onNavigate: (data: { type: string; id: string }) => void
) {
  if (!supportsLocalNotifications()) {
    return () => {};
  }

  try {
    const handle = async (notification: Notifications.Notification) => {
      const data = notification.request.content.data as {
        type?: NotificationType;
        id?: string;
      };
      const content = notification.request.content;

      if (content.title && content.body && data?.type) {
        await saveIncomingNotification({
          type: data.type,
          title: String(content.title).replace(/^[^\w]+\s*/, ""),
          body: String(content.body),
          sourceId: data.id,
          broadcastId: data.type === "broadcast" ? data.id : undefined,
        }).catch(() => {});
      }

      if (data?.type && data?.id) {
        onNavigate({ type: data.type, id: data.id });
      }
    };

    const sub1 = Notifications.addNotificationReceivedListener(handle);

    const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
      handle(response.notification);
    });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  } catch {
    return () => {};
  }
}

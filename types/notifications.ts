export type NotificationType =
  | "maintenance"
  | "warranty"
  | "appliance"
  | "subscription"
  | "broadcast"
  | "system";

export type InboxNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  sourceId?: string;
  broadcastId?: string;
};

export type NotificationPreferences = {
  notificationsEnabled: boolean;
  maintenanceReminders: boolean;
  warrantyAlerts: boolean;
  applianceReminders: boolean;
  subscriptionReminders: boolean;
  adminBroadcasts: boolean;
  emailDigest: boolean;
};

export type AdminBroadcast = {
  id: string;
  title: string;
  body: string;
  sent_by: string | null;
  is_active: boolean;
  created_at: string;
};

export type AdminBroadcastInput = {
  title: string;
  body: string;
};

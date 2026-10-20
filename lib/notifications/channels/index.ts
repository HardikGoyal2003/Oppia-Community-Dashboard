import type { NotificationChannel } from "@/lib/domain/notifications.types";
import { emailNotificationChannel } from "./email.channel";
import { inAppNotificationChannel } from "./in-app.channel";

/**
 * Registered notification transports, attempted in order. Adding a new
 * transport (Google Chat, Slack, ...) means creating a channel module and
 * registering it here — nothing else changes.
 */
export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  inAppNotificationChannel,
  emailNotificationChannel,
];

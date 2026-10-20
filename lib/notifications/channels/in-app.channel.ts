import { appendUserNotificationByUid } from "@/db/users/notifications/notifications.db";
import type {
  NotificationChannel,
  NotificationChannelResult,
  NotificationMessage,
  NotificationRecipient,
} from "@/lib/domain/notifications.types";

/**
 * In-app transport that appends to the user's notification bell. Always
 * available; it doubles as the fallback for leads without an email address.
 */
export const inAppNotificationChannel: NotificationChannel = {
  key: "IN_APP",

  isAvailable(): boolean {
    return true;
  },

  async send(
    recipients: NotificationRecipient[],
    message: NotificationMessage,
  ): Promise<NotificationChannelResult> {
    const result: NotificationChannelResult = {
      channel: "IN_APP",
      deliveredTo: [],
      failed: [],
    };

    // The bell renders plain text, so the message stays on one line with the
    // dashboard path appended for quick navigation.
    const notificationText = `${message.title} Open ${message.deepLinkPath} to review.`;

    for (const recipient of recipients) {
      try {
        await appendUserNotificationByUid(recipient.uid, notificationText);
        result.deliveredTo.push(recipient.uid);
      } catch (error) {
        result.failed.push({
          uid: recipient.uid,
          reason:
            error instanceof Error ? error.message : "In-app send failed.",
        });
      }
    }

    return result;
  },
};

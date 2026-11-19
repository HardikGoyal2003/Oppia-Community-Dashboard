import type { Notification } from "@/lib/auth/auth.types";
import {
  getNotificationsByUid as getNotificationsByUidRecord,
  markNotificationAsReadByUid as markNotificationAsReadByUidRecord,
} from "@/db/users/notifications/notifications.db";

export type NotificationStatusFilter = "READ" | "UNREAD" | "ALL";

/**
 * Retrieves notifications for a user.
 *
 * @param uid The user id to query by.
 * @param status The notification status filter.
 * @returns The notifications sorted by creation time descending.
 */
export async function getNotificationsByUid(
  uid: string,
  status: NotificationStatusFilter = "ALL",
): Promise<Notification[]> {
  return getNotificationsByUidRecord(uid, status);
}

/**
 * Marks a user notification as read.
 *
 * @param uid The user id that owns the notification.
 * @param notificationId The notification document id to update.
 * @returns A promise that resolves when the notification has been marked as read.
 */
export async function markNotificationAsReadByUid(
  uid: string,
  notificationId: string,
): Promise<void> {
  await markNotificationAsReadByUidRecord(uid, notificationId);
}

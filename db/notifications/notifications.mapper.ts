import { Notification } from "@/lib/auth/auth.types";
import { normalizeTimestamp } from "@/db/timestamp.utils";

/**
 * Normalizes notification timestamps after reading notification documents.
 *
 * @param value The raw notification records.
 * @returns The notifications with normalized Date instances.
 */
export function normalizeNotifications(value: Notification[]): Notification[] {
  return value.map((notification) => {
    return {
      id: notification.id,
      message: notification.message,
      read: notification.read,
      createdAt: normalizeTimestamp(notification.createdAt),
    };
  });
}

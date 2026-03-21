import { Notification } from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeTimestamp } from "@/db/timestamp.utils";

export type FirestoreNotification = {
  message: string;
  read: boolean;
  createdAt: Timestamp;
};

/**
 * Validates the raw Firestore notification document shape.
 *
 * @param notification The raw Firestore notification document data.
 * @returns Nothing. Throws when the notification document shape is invalid.
 */
function assertFirestoreNotification(
  notification: FirebaseFirestore.DocumentData,
): asserts notification is FirestoreNotification {
  if (typeof notification.message !== "string") {
    throw new Error("Notification message must be a string.");
  }

  if (typeof notification.read !== "boolean") {
    throw new Error("Notification read must be a boolean.");
  }
}

/**
 * Normalizes notification timestamps after reading notification documents.
 *
 * @param value The raw notification records.
 * @returns The notifications with normalized Date instances.
 */
export function normalizeNotifications(
  value: Array<FirestoreNotification & { id: string }>,
): Notification[] {
  return value.map((notification) => {
    return {
      id: notification.id,
      message: notification.message,
      read: notification.read,
      createdAt: normalizeTimestamp(notification.createdAt),
    };
  });
}

/**
 * Normalizes raw Firestore notification document data into the app model.
 *
 * @param notification The raw Firestore notification document data with its id.
 * @returns The normalized notification model.
 */
export function normalizeNotificationDocument(
  notification: FirebaseFirestore.DocumentData & { id: string },
): Notification {
  const { id, ...rawNotification } = notification;
  assertFirestoreNotification(rawNotification);

  return normalizeNotifications([{ id, ...rawNotification }])[0];
}

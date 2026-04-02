import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { Notification } from "@/lib/auth/auth.types";
import { DB_PATHS } from "@/db/db-paths";
import { DbNotFoundError } from "@/db/db.errors";
import {
  type FirestoreNotification,
  normalizeNotificationDocument,
  serializeNotification,
} from "@/db/users/notifications/notifications.mapper";

export type NotificationStatusFilter = "READ" | "UNREAD" | "ALL";

const db = getAdminFirestore();

/**
 * Resolves the notifications subcollection for a user uid.
 *
 * @param uid The user id that owns the notifications.
 * @returns The typed notifications subcollection reference.
 */
export function getUserNotificationsCollection(
  uid: string,
): FirebaseFirestore.CollectionReference<FirestoreNotification> {
  return db
    .collection(DB_PATHS.USERS.COLLECTION)
    .doc(uid)
    .collection(
      DB_PATHS.USERS.NOTIFICATIONS_SUBCOLLECTION,
    ) as FirebaseFirestore.CollectionReference<FirestoreNotification>;
}

/**
 * Appends a notification to a user located by uid.
 *
 * @param uid The user id to update.
 * @param message The notification message to append.
 * @returns A promise that resolves when the notification has been written.
 */
export async function appendUserNotificationByUid(
  uid: string,
  message: string,
): Promise<void> {
  await getUserNotificationsCollection(uid)
    .doc()
    .set(
      serializeNotification({
        message,
        createdAt: new Date(),
        read: false,
      }),
    );
}

/**
 * Retrieves notifications for a user id, optionally filtered by read status.
 *
 * @param uid The user id to query by.
 * @param status The optional notification status filter.
 * @returns The normalized notifications sorted by creation time descending.
 */
export async function getNotificationsByUid(
  uid: string,
  status: NotificationStatusFilter = "ALL",
): Promise<Notification[]> {
  let query: FirebaseFirestore.Query = getUserNotificationsCollection(uid);

  if (status === "READ") {
    query = query.where("read", "==", true);
  } else if (status === "UNREAD") {
    query = query.where("read", "==", false);
  }

  const snapshot = await query.orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) =>
    normalizeNotificationDocument({
      id: doc.id,
      ...doc.data(),
    }),
  );
}

/**
 * Marks a notification as read for the user identified by uid.
 *
 * @param uid The user id to query by.
 * @param notificationId The notification document id to update.
 * @returns A promise that resolves when the notification has been marked as read.
 */
export async function markNotificationAsReadByUid(
  uid: string,
  notificationId: string,
): Promise<void> {
  const notificationRef =
    getUserNotificationsCollection(uid).doc(notificationId);
  const notificationSnap = await notificationRef.get();

  if (!notificationSnap.exists) {
    throw new DbNotFoundError("Notification");
  }

  await notificationRef.update({
    read: true,
  });
}

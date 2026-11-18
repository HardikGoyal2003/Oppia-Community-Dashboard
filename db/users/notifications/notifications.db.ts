import { Notification } from "@/lib/auth/auth.types";
import { updateRequiredDocument } from "@/db/utils/document.utils";
import {
  getRequiredUserDocRefByUid,
  getUserNotificationsCollection,
} from "@/db/users/users.refs";
import {
  type FirestoreNotification,
  normalizeNotificationDocument,
  serializeNotification,
} from "@/db/users/notifications/notifications.mapper";

export { getUserNotificationsCollection };

type NotificationStatusFilter = "READ" | "UNREAD" | "ALL";

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
  const userDocRef = await getRequiredUserDocRefByUid(uid);

  await getUserNotificationsCollection(userDocRef)
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
 * @firestore-index notifications read,createdAt
 */
export async function getNotificationsByUid(
  uid: string,
  status: NotificationStatusFilter = "ALL",
): Promise<Notification[]> {
  const userDocRef = await getRequiredUserDocRefByUid(uid);
  let query: FirebaseFirestore.Query<FirestoreNotification> =
    getUserNotificationsCollection(userDocRef);

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
  const userDocRef = await getRequiredUserDocRefByUid(uid);
  const notificationRef =
    getUserNotificationsCollection(userDocRef).doc(notificationId);

  await updateRequiredDocument("Notification", notificationRef, {
    read: true,
  });
}

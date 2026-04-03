import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { Notification } from "@/lib/auth/auth.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  getRequiredDocumentRef,
  getRequiredDocumentSnapshot,
} from "@/db/utils/document.utils";
import {
  type FirestoreNotification,
  normalizeNotificationDocument,
  serializeNotification,
} from "@/db/users/notifications/notifications.mapper";

export type NotificationStatusFilter = "READ" | "UNREAD" | "ALL";

const db = getAdminFirestore();

/**
 * Resolves a user document reference by uid and guarantees that the document exists.
 *
 * @param uid The user id that owns the notifications.
 * @returns The existing Firestore user document reference.
 */
async function getRequiredUserDocRefByUid(
  uid: string,
): Promise<FirebaseFirestore.DocumentReference> {
  const userDocRef = db.collection(DB_PATHS.USERS.COLLECTION).doc(uid);
  return getRequiredDocumentRef("User", userDocRef);
}

/**
 * Resolves the notifications subcollection for a user uid.
 *
 * @param userDocRef The existing user document reference.
 * @returns The typed notifications subcollection reference.
 */
export function getUserNotificationsCollection(
  userDocRef: FirebaseFirestore.DocumentReference,
): FirebaseFirestore.CollectionReference<FirestoreNotification> {
  return userDocRef.collection(
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
 */
export async function getNotificationsByUid(
  uid: string,
  status: NotificationStatusFilter = "ALL",
): Promise<Notification[]> {
  const userDocRef = await getRequiredUserDocRefByUid(uid);
  let query: FirebaseFirestore.Query =
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
  await getRequiredDocumentSnapshot("Notification", notificationRef);

  await notificationRef.update({
    read: true,
  });
}

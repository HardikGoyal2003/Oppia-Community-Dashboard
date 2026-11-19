import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import { getRequiredTransactionDocumentSnapshot } from "@/db/utils/document.utils";
import type { FirestoreUser } from "./users.mapper";
import type { FirestoreNotification } from "./notifications/notifications.mapper";

const db = getAdminFirestore();

/** Typed collection reference for user documents. */
export const usersCollection = db.collection(
  DB_PATHS.USERS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreUser>;

/**
 * Resolves a user document reference inside a transaction and guarantees it exists.
 *
 * @param tx The active Firestore transaction.
 * @param uid The user id to fetch.
 * @returns The existing user document reference.
 */
export async function getRequiredUserDocRefInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
): Promise<FirebaseFirestore.DocumentReference<FirestoreUser>> {
  const userDocRef = usersCollection.doc(uid);
  await getRequiredTransactionDocumentSnapshot(tx, "User", userDocRef);
  return userDocRef;
}

/**
 * Resolves the notifications subcollection for a user document.
 *
 * @param userDocRef The existing user document reference.
 * @returns The typed notifications subcollection reference.
 */
export function getUserNotificationsCollection(
  userDocRef: FirebaseFirestore.DocumentReference<FirestoreUser>,
): FirebaseFirestore.CollectionReference<FirestoreNotification> {
  return userDocRef.collection(
    DB_PATHS.USERS.NOTIFICATIONS_SUBCOLLECTION,
  ) as FirebaseFirestore.CollectionReference<FirestoreNotification>;
}

/**
 * Resolves the notifications subcollection for a user by uid.
 *
 * @param uid The user id that owns the notifications subcollection.
 * @returns The typed notifications subcollection reference.
 */
export function getUserNotificationsCollectionByUid(
  uid: string,
): FirebaseFirestore.CollectionReference<FirestoreNotification> {
  return usersCollection
    .doc(uid)
    .collection(
      DB_PATHS.USERS.NOTIFICATIONS_SUBCOLLECTION,
    ) as FirebaseFirestore.CollectionReference<FirestoreNotification>;
}

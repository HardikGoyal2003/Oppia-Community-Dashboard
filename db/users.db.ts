import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  Notification,
  ContributionPlatform,
  UserRole,
  UserModel,
} from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeNotifications } from "./notifications/notifications.mapper";
import { normalizeTimestamp } from "./timestamp.utils";

const USERS_COLLECTION = "users";
const NOTIFICATIONS_SUBCOLLECTION = "notifications";

const db = getAdminFirestore();

type NotificationStatusFilter = "READ" | "UNREAD" | "ALL";

/**
 * Validates the GitHub username requirement for non-contributor roles.
 *
 * @param role The role being assigned.
 * @param githubUsername The GitHub username associated with the user.
 * @returns Nothing. Throws when the role requires a GitHub username and one is missing.
 */
function assertGithubUsernameForRole(githubUsername: string) {
  if (!githubUsername.trim()) {
    throw new Error("githubUsername is required.");
  }
}

/**
 * Retrieves the first user document snapshot that matches an email address.
 *
 * @param email The email address to query by.
 * @returns The matching Firestore user document snapshot.
 */
async function getUserDocRefByEmail(email: string) {
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error("User not found for member access request.");
  }

  return snapshot.docs[0];
}

/**
 * Retrieves a user by email address.
 *
 * @param email The email address to query by.
 * @returns The normalized user model, or null when no user exists.
 */
export async function getUserByEmail(email: string): Promise<UserModel | null> {
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const data = snapshot.docs[0].data();

  return {
    ...(data as UserModel),
    createdAt: normalizeTimestamp(data.createdAt),
  };
}

/**
 * Creates a user document on first login when one does not already exist.
 *
 * @param uid The user id to write under.
 * @param data The user payload to persist.
 * @returns A promise that resolves when the user has been ensured in Firestore.
 */
export async function createUserIfNotExists(
  uid: string,
  data: Omit<UserModel, "createdAt">,
): Promise<void> {
  assertGithubUsernameForRole(data.githubUsername);

  const ref = db.collection(USERS_COLLECTION).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const now = Timestamp.now();

    await ref.set({
      ...data,
      createdAt: now,
    });
  }
}

/**
 * Retrieves a user by uid.
 *
 * @param uid The user id to fetch.
 * @returns The normalized user model, or null when no user exists.
 */
export async function getUserById(uid: string): Promise<UserModel | null> {
  const snap = await db.collection(USERS_COLLECTION).doc(uid).get();

  if (!snap.exists) return null;

  const data = snap.data()!;

  return {
    ...data,
    createdAt: normalizeTimestamp(data.createdAt),
  } as UserModel;
}

/**
 * Retrieves all users across platforms.
 *
 * @returns The normalized user models with document ids attached.
 */
export async function getAllUsers(): Promise<(UserModel & { id: string })[]> {
  return getUsersByPlatform();
}

/**
 * Retrieves users, optionally scoped to a contribution platform.
 *
 * @param platform The optional contribution platform filter.
 * @returns The normalized user models with document ids attached.
 */
export async function getUsersByPlatform(
  platform?: ContributionPlatform,
): Promise<(UserModel & { id: string })[]> {
  let query: FirebaseFirestore.Query = db.collection(USERS_COLLECTION);

  if (platform) {
    query = query.where("platform", "==", platform);
  }

  const snap = await query.get();

  return snap.docs
    .map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...(data as UserModel),
        createdAt: normalizeTimestamp(data.createdAt),
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Updates the role of an existing user.
 *
 * @param uid The user id to update.
 * @param role The new role value.
 * @returns A promise that resolves when the update has been written.
 */
export async function updateUserRole(
  uid: string,
  role: UserRole,
): Promise<void> {
  await db.collection(USERS_COLLECTION).doc(uid).update({
    role,
  });
}

/**
 * Updates the contribution platform for an existing user.
 *
 * @param uid The user id to update.
 * @param platform The platform value to persist.
 * @returns A promise that resolves when the update has been written.
 */
export async function updateUserPlatformByUid(
  uid: string,
  platform: ContributionPlatform,
): Promise<void> {
  await db.collection(USERS_COLLECTION).doc(uid).update({ platform });
}

/**
 * Updates a user's role and team by uid.
 *
 * @param uid The user id to update.
 * @param role The new role value.
 * @param team The new team value.
 * @param githubUsername The GitHub username to persist.
 * @returns A promise that resolves when the user update has been written.
 */
export async function updateUserRoleAndTeamByUid(
  uid: string,
  role: UserRole,
  team: string | null,
  githubUsername: string,
): Promise<void> {
  assertGithubUsernameForRole(githubUsername);

  const ref = db.collection(USERS_COLLECTION).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error("User not found.");
  }

  await ref.update({
    role,
    team,
    githubUsername,
  });
}

/**
 * Updates a user's role and team by email address.
 *
 * @param email The email address to query by.
 * @param role The new role value.
 * @param team The new team value.
 * @param githubUsername The GitHub username to persist.
 * @returns A promise that resolves when the update has been written.
 */
export async function updateUserRoleAndTeamByEmail(
  email: string,
  role: UserRole,
  team: string,
  githubUsername: string,
): Promise<void> {
  assertGithubUsernameForRole(githubUsername);

  const userDoc = await getUserDocRefByEmail(email);

  await userDoc.ref.update({
    role,
    team,
    githubUsername,
  });
}

/**
 * Appends a notification to a user located by email address.
 *
 * @param email The email address to query by.
 * @param message The notification message to append.
 * @returns A promise that resolves when the notification has been written.
 */
export async function appendUserNotificationByEmail(
  email: string,
  message: string,
): Promise<void> {
  const userDoc = await getUserDocRefByEmail(email);
  await appendNotificationByUserDocRef(userDoc.ref, {
    message,
    createdAt: new Date(),
    read: false,
  });
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
  const userDocRef = db.collection(USERS_COLLECTION).doc(uid);
  const userDocSnap = await userDocRef.get();

  if (!userDocSnap.exists) {
    throw new Error("User not found.");
  }

  await appendNotificationByUserDocRef(userDocRef, {
    message,
    createdAt: new Date(),
    read: false,
  });
}

/**
 * Retrieves notifications for a user, optionally filtered by read status.
 *
 * @param email The email address to query by.
 * @param status The optional notification status filter.
 * @returns The normalized notifications sorted by creation time descending.
 */
export async function getNotificationsByEmail(
  email: string,
  status: NotificationStatusFilter = "ALL",
): Promise<Notification[]> {
  const userDoc = await getUserDocRefByEmail(email);
  let query: FirebaseFirestore.Query = userDoc.ref.collection(
    NOTIFICATIONS_SUBCOLLECTION,
  );

  if (status === "READ") {
    query = query.where("read", "==", true);
  } else if (status === "UNREAD") {
    query = query.where("read", "==", false);
  }

  const snapshot = await query.orderBy("createdAt", "desc").get();

  return normalizeNotifications(
    snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Notification, "id">),
    })),
  );
}

/**
 * Marks a notification as read for the user identified by email address.
 *
 * @param email The email address to query by.
 * @param notificationId The notification document id to update.
 * @returns A promise that resolves when the notification has been marked as read.
 */
export async function markNotificationAsReadByEmail(
  email: string,
  notificationId: string,
): Promise<void> {
  const userDoc = await getUserDocRefByEmail(email);
  const notificationRef = userDoc.ref
    .collection(NOTIFICATIONS_SUBCOLLECTION)
    .doc(notificationId);
  const notificationSnap = await notificationRef.get();

  if (!notificationSnap.exists) {
    throw new Error("Notification not found.");
  }

  await notificationRef.update({
    read: true,
  });
}

/**
 * Appends a notification document under an already-resolved user document reference.
 *
 * @param userDocRef The Firestore user document reference.
 * @param notification The notification payload to persist.
 * @returns A promise that resolves when the notification has been written.
 */
async function appendNotificationByUserDocRef(
  userDocRef: FirebaseFirestore.DocumentReference,
  notification: Omit<Notification, "id">,
): Promise<void> {
  const notificationRef = userDocRef
    .collection(NOTIFICATIONS_SUBCOLLECTION)
    .doc();

  await notificationRef.set({
    message: notification.message,
    read: notification.read,
    createdAt: Timestamp.fromDate(notification.createdAt),
  });
}

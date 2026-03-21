import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  Notification,
  ContributionPlatform,
  UserRole,
  UserModel,
} from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeNotifications } from "./notifications/notifications.mapper";

const USERS_COLLECTION = "users";
const NOTIFICATIONS_SUBCOLLECTION = "notifications";

const db = getAdminFirestore();

type NotificationStatusFilter = "READ" | "UNREAD" | "ALL";

function assertGithubUsernameForRole(
  role: UserRole,
  githubUsername: string | null,
) {
  if (role !== "CONTRIBUTOR" && !githubUsername) {
    throw new Error("githubUsername is required for non-contributor roles.");
  }
}

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
    createdAt: data.createdAt.toDate(),
  };
}

/**
 * Create user on first login (idempotent)
 */
export async function createUserIfNotExists(
  uid: string,
  data: Omit<UserModel, "createdAt">,
): Promise<void> {
  assertGithubUsernameForRole(data.role, data.githubUsername);

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
 * Get user by UID
 */
export async function getUserById(uid: string): Promise<UserModel | null> {
  const snap = await db.collection(USERS_COLLECTION).doc(uid).get();

  if (!snap.exists) return null;

  const data = snap.data()!;

  return {
    ...data,
    createdAt: data.createdAt.toDate(),
  } as UserModel;
}

/**
 * Get all users (Area Lead only)
 */
export async function getAllUsers(): Promise<(UserModel & { id: string })[]> {
  return getUsersByPlatform();
}

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
        createdAt: data.createdAt.toDate(),
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Update user role (Area Lead only)
 */
export async function updateUserRole(
  uid: string,
  role: UserRole,
): Promise<void> {
  await db.collection(USERS_COLLECTION).doc(uid).update({
    role,
  });
}

export async function updateUserPlatformByUid(
  uid: string,
  platform: ContributionPlatform,
): Promise<void> {
  await db.collection(USERS_COLLECTION).doc(uid).update({ platform });
}

export async function updateUserRoleTeamAndNotifyByUid(
  uid: string,
  role: UserRole,
  team: string | null,
  reason: string,
  githubUsername: string | null,
  changedByEmail?: string,
): Promise<void> {
  assertGithubUsernameForRole(role, githubUsername);

  const ref = db.collection(USERS_COLLECTION).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error("User not found.");
  }

  const roleLabel = role.replace("_", " ");
  const teamLabel = team ?? "Unassigned";
  const actor = changedByEmail ?? "Admin";

  const message = [
    `Your access details were updated by ${actor}.`,
    `New role: ${roleLabel}`,
    `New team: ${teamLabel}`,
    `Reason: ${reason}`,
  ].join("\n");

  await appendNotificationByUserDocRef(ref, {
    message,
    createdAt: new Date(),
    read: false,
  });

  await ref.update({
    role,
    team,
    githubUsername,
  });
}

export async function updateUserRoleAndTeamByEmail(
  email: string,
  role: UserRole,
  team: string,
  githubUsername: string | null,
): Promise<void> {
  assertGithubUsernameForRole(role, githubUsername);

  const userDoc = await getUserDocRefByEmail(email);

  await userDoc.ref.update({
    role,
    team,
    githubUsername,
  });
}

export async function updateUserRoleTeamAndNotifyByEmail(
  email: string,
  role: UserRole,
  team: string,
  githubUsername: string | null,
  message: string,
): Promise<void> {
  assertGithubUsernameForRole(role, githubUsername);

  const userDoc = await getUserDocRefByEmail(email);
  const docRef = userDoc.ref;
  await appendNotificationByUserDocRef(docRef, {
    message,
    createdAt: new Date(),
    read: false,
  });

  await docRef.update({
    role,
    team,
    githubUsername,
  });
}

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

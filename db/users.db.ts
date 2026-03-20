import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  Notification,
  ContributionPlatform,
  UserRole,
  UserModel,
} from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";
import {
  normalizeNotifications,
} from "./notifications/notifications.mapper";

const USERS_COLLECTION = "users";
const NOTIFICATIONS_SUBCOLLECTION = "notifications";

const db = getAdminFirestore();

function assertGithubUsernameForRole(
  role: UserRole,
  githubUsername: string | null
) {
  if (role !== "CONTRIBUTOR" && !githubUsername) {
    throw new Error(
      "githubUsername is required for non-contributor roles."
    );
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

export async function getUserByEmail(
  email: string
): Promise<UserModel | null> {
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
  data: Omit<UserModel, "createdAt">
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
export async function getUserById(
  uid: string
): Promise<UserModel | null> {
  const snap = await db
    .collection(USERS_COLLECTION)
    .doc(uid)
    .get();

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
export async function getAllUsers(): Promise<
  (UserModel & { id: string })[]
> {
  const snap = await db
    .collection(USERS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map(doc => {
    const data = doc.data();

    return {
      id: doc.id,
      ...(data as UserModel),
      createdAt: data.createdAt.toDate(),
    };
  });
}

/**
 * Update user role (Area Lead only)
 */
export async function updateUserRole(
  uid: string,
  role: UserRole
): Promise<void> {
  await db
    .collection(USERS_COLLECTION)
    .doc(uid)
    .update({
      role
    });
}

export async function updateUserPlatformByUid(
  uid: string,
  platform: ContributionPlatform
): Promise<void> {
  await db
    .collection(USERS_COLLECTION)
    .doc(uid)
    .update({ platform });
}

export async function updateUserRoleTeamAndNotifyByUid(
  uid: string,
  role: UserRole,
  team: string | null,
  reason: string,
  githubUsername: string | null,
  changedByEmail?: string
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
  githubUsername: string | null
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
  message: string
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
  message: string
): Promise<void> {
  const userDoc = await getUserDocRefByEmail(email);
  await appendNotificationByUserDocRef(userDoc.ref, {
    message,
    createdAt: new Date(),
    read: false,
  });
}

export async function getNotificationsByEmail(
  email: string
): Promise<Notification[]> {
  const userDoc = await getUserDocRefByEmail(email);
  const snapshot = await userDoc.ref
    .collection(NOTIFICATIONS_SUBCOLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return normalizeNotifications(
    snapshot.docs.map(doc => doc.data() as Notification)
  );
}

export async function markNotificationAsReadByEmail(
  email: string,
  notificationIndex: number
): Promise<void> {
  const userDoc = await getUserDocRefByEmail(email);
  const snapshot = await userDoc.ref
    .collection(NOTIFICATIONS_SUBCOLLECTION)
    .orderBy("createdAt", "desc")
    .get();
  const notifications = snapshot.docs;

  if (
    notificationIndex < 0 ||
    notificationIndex >= notifications.length
  ) {
    throw new Error("Notification index out of bounds.");
  }

  await notifications[notificationIndex].ref.update({
    read: true,
  });
}

async function appendNotificationByUserDocRef(
  userDocRef: FirebaseFirestore.DocumentReference,
  notification: Notification
): Promise<void> {
  await userDocRef
    .collection(NOTIFICATIONS_SUBCOLLECTION)
    .add({
      ...notification,
      createdAt: Timestamp.fromDate(notification.createdAt),
    });
}

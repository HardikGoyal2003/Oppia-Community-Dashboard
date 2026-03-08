import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  Notification,
  UserRole,
  UserModel,
} from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";
import {
  normalizeNotifications,
  serializeNotifications,
} from "./notifications/notifications.mapper";

const USERS_COLLECTION = "users";

const db = getAdminFirestore();

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
 * Create user on first login (idempotent)
 */
export async function createUserIfNotExists(
  uid: string,
  data: Omit<UserModel, "createdAt">
): Promise<void> {
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
    notifications: normalizeNotifications(data.notifications),
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
      notifications: normalizeNotifications(data.notifications),
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

export async function updateUserRoleAndTeamByEmail(
  email: string,
  role: UserRole,
  team: string
): Promise<void> {
  const userDoc = await getUserDocRefByEmail(email);

  await userDoc.ref.update({
    role,
    team,
  });
}

export async function updateUserRoleTeamAndNotifyByEmail(
  email: string,
  role: UserRole,
  team: string,
  message: string
): Promise<void> {
  const userDoc = await getUserDocRefByEmail(email);
  const docRef = userDoc.ref;
  const data = userDoc.data() as Partial<UserModel>;

  const notifications = normalizeNotifications(
    (data.notifications ?? []) as Notification[]
  );

  notifications.push({
    message,
    createdAt: new Date(),
    read: false,
  });

  await docRef.update({
    role,
    team,
    notifications: serializeNotifications(notifications),
  });
}

export async function appendUserNotificationByEmail(
  email: string,
  message: string
): Promise<void> {
  const userDoc = await getUserDocRefByEmail(email);
  const docRef = userDoc.ref;
  const data = userDoc.data() as Partial<UserModel>;

  const notifications = normalizeNotifications(
    (data.notifications ?? []) as Notification[]
  );

  notifications.push({
    message,
    createdAt: new Date(),
    read: false,
  });

  await docRef.update({
    notifications: serializeNotifications(notifications),
  });
}

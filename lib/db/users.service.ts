import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { UserRole, UserModel } from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";

const USERS_COLLECTION = "users";

const db = getAdminFirestore();


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
    notifications: data.notifications,
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
      notifications: data.notifications,
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

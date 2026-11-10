import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  ContributionPlatform,
  UserRole,
  UserModel,
} from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";
import { DB_PATHS } from "../db-paths";
import { DbNotFoundError, DbValidationError } from "../db.errors";
import { getRequiredDocumentRef } from "../utils/document.utils";
import { getUserNotificationsCollection } from "./notifications/notifications.db";
import { serializeNotification } from "./notifications/notifications.mapper";
import { normalizeUserDocument, serializeUser } from "./users.mapper";
import type { FirestoreUser } from "./users.mapper";

const db = getAdminFirestore();
export const usersCollection = db.collection(
  DB_PATHS.USERS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreUser>;

/** Maximum number of writes Firestore accepts in a single batch. */
const FIRESTORE_BATCH_LIMIT = 400;

export type UserRecord = UserModel & {
  id: string;
};

/**
 * Splits a list into fixed-size chunks so writes stay within Firestore's batch
 * limit.
 *
 * @param values The values to split.
 * @param size The maximum chunk size.
 * @returns The chunked values.
 */
function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

/**
 * Validates the GitHub username requirement for non-contributor roles.
 *
 * @param role The role being assigned.
 * @param githubUsername The GitHub username associated with the user.
 * @returns Nothing. Throws when the role requires a GitHub username and one is missing.
 */
function assertGithubUsernameForRole(githubUsername: string) {
  if (!githubUsername.trim()) {
    throw new DbValidationError(
      "githubUsername",
      "githubUsername is required.",
    );
  }
}

/**
 * Determines whether a Firestore create failure represents an existing document.
 *
 * @param error The thrown Firestore error candidate.
 * @returns True when the error indicates the document already exists.
 */
function isDocumentAlreadyExistsError(error: object): boolean {
  if ("code" in error && error.code === 6) {
    return true;
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message.toUpperCase().includes("ALREADY_EXISTS");
  }

  return false;
}

/**
 * Resolves a user document reference by uid and guarantees that the document exists.
 *
 * @param uid The user id to fetch.
 * @returns The existing Firestore user document reference.
 */
async function getRequiredUserDocRefByUid(
  uid: string,
): Promise<FirebaseFirestore.DocumentReference> {
  const userDocRef = usersCollection.doc(uid);
  return getRequiredDocumentRef("User", userDocRef);
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
  data: Omit<UserModel, "createdAt" | "schemaVersion">,
): Promise<void> {
  assertGithubUsernameForRole(data.githubUsername);

  const ref = usersCollection.doc(uid);
  const now = Timestamp.now();

  try {
    await ref.create(
      serializeUser({
        ...data,
        createdAt: now,
      }),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      isDocumentAlreadyExistsError(error)
    ) {
      return;
    }

    throw error;
  }
}

/**
 * Retrieves a user by uid.
 *
 * @param uid The user id to fetch.
 * @returns The normalized user model, or null when no user exists.
 */
export async function getUserById(uid: string): Promise<UserModel | null> {
  const snap = await usersCollection.doc(uid).get();

  if (!snap.exists) return null;

  const data = snap.data()!;

  return normalizeUserDocument(data);
}

/**
 * Retrieves all users across platforms.
 *
 * @returns The normalized user models with document ids attached.
 */
export async function getAllUsers(): Promise<UserRecord[]> {
  return getUsersByPlatform();
}

/**
 * Retrieves users, optionally scoped to a contribution platform.
 *
 * @param platform The optional contribution platform filter.
 * @returns The normalized user models with document ids attached.
 * @firestore-index users platform,createdAt
 */
export async function getUsersByPlatform(
  platform?: ContributionPlatform,
): Promise<UserRecord[]> {
  let query: FirebaseFirestore.Query = usersCollection;

  if (platform) {
    query = query.where("platform", "==", platform);
  }

  const snap = await query.orderBy("createdAt", "desc").get();

  return snap.docs.map((doc) => {
    return {
      id: doc.id,
      ...normalizeUserDocument(doc.data()),
    };
  });
}

/**
 * Retrieves users belonging to a specific team.
 *
 * @param teamKey The team key to filter by (e.g. "LEAP", "CORE").
 * @returns The normalized user models with document ids attached.
 * @firestore-index users team,createdAt
 */
export async function getUsersByTeam(teamKey: string): Promise<UserRecord[]> {
  const snap = await usersCollection
    .where("team", "==", teamKey)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => {
    return {
      id: doc.id,
      ...normalizeUserDocument(doc.data()),
    };
  });
}

/**
 * Updates the role of many users using batched writes.
 *
 * This is intended for bulk maintenance jobs where the user documents were
 * just read, so no per-user existence check is required. Batching keeps the
 * number of network round trips low enough for serverless execution limits.
 *
 * @param updates The user ids and the role to assign to each one.
 * @returns A promise that resolves when all batches have been committed.
 */
export async function updateUserRoles(
  updates: Array<{ uid: string; role: UserRole }>,
): Promise<void> {
  for (const chunk of chunkValues(updates, FIRESTORE_BATCH_LIMIT)) {
    const batch = usersCollection.firestore.batch();

    for (const { uid, role } of chunk) {
      batch.update(usersCollection.doc(uid), { role });
    }

    await batch.commit();
  }
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
  const userDocRef = await getRequiredUserDocRefByUid(uid);

  await userDocRef.update({ platform });
}

/**
 * Updates a user's role and team by uid and appends a notification atomically.
 *
 * @param uid The user id to update.
 * @param role The new role value.
 * @param team The new team value.
 * @param githubUsername The GitHub username to persist.
 * @param message The notification message to append.
 * @returns A promise that resolves when the update and notification write have been committed.
 */
export async function updateUserRoleAndTeamWithNotificationByUid(
  uid: string,
  role: UserRole,
  team: string | null,
  githubUsername: string,
  message: string,
): Promise<void> {
  assertGithubUsernameForRole(githubUsername);

  const userDocRef = await getRequiredUserDocRefByUid(uid);
  const notificationRef = getUserNotificationsCollection(userDocRef).doc();
  const batch = usersCollection.firestore.batch();

  batch.update(userDocRef, {
    role,
    team,
    githubUsername,
  });
  batch.set(notificationRef, {
    ...serializeNotification({
      message,
      read: false,
      createdAt: new Date(),
    }),
  });

  await batch.commit();
}

/**
 * Resolves a user document reference inside a transaction and guarantees it exists.
 *
 * @param tx The active Firestore transaction.
 * @param uid The user id to fetch.
 * @returns The existing user document reference.
 * @throws {DbNotFoundError} When the user document does not exist.
 */
async function getRequiredUserDocRefInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
): Promise<FirebaseFirestore.DocumentReference> {
  const userDocRef = usersCollection.doc(uid);
  const snapshot = await tx.get(userDocRef);

  if (!snapshot.exists) {
    throw new DbNotFoundError("User");
  }

  return userDocRef;
}

/**
 * Appends a notification to a user inside a transaction.
 *
 * @param tx The active Firestore transaction.
 * @param userDocRef The existing user document reference.
 * @param message The notification message to append.
 * @returns Nothing.
 */
function appendNotificationInTransaction(
  tx: FirebaseFirestore.Transaction,
  userDocRef: FirebaseFirestore.DocumentReference,
  message: string,
): void {
  tx.set(getUserNotificationsCollection(userDocRef).doc(), {
    ...serializeNotification({
      message,
      read: false,
      createdAt: new Date(),
    }),
  });
}

/**
 * Updates a user's role and team and appends a notification inside a transaction.
 *
 * @param tx The active Firestore transaction.
 * @param uid The user id to update.
 * @param role The new role value.
 * @param team The new team value.
 * @param githubUsername The GitHub username to persist.
 * @param message The notification message to append.
 * @returns A promise that resolves when the writes have been staged in the transaction.
 */
export async function updateUserRoleAndTeamWithNotificationInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  role: UserRole,
  team: string | null,
  githubUsername: string,
  message: string,
): Promise<void> {
  assertGithubUsernameForRole(githubUsername);

  const userDocRef = await getRequiredUserDocRefInTransaction(tx, uid);

  tx.update(userDocRef, {
    role,
    team,
    githubUsername,
  });
  appendNotificationInTransaction(tx, userDocRef, message);
}

/**
 * Appends a notification to a user inside a transaction.
 *
 * @param tx The active Firestore transaction.
 * @param uid The user id that owns the notification.
 * @param message The notification message to append.
 * @returns A promise that resolves when the write has been staged in the transaction.
 */
export async function appendUserNotificationInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  message: string,
): Promise<void> {
  const userDocRef = await getRequiredUserDocRefInTransaction(tx, uid);
  appendNotificationInTransaction(tx, userDocRef, message);
}

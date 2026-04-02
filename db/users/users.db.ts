import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  ContributionPlatform,
  UserRole,
  UserModel,
} from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";
import { DB_PATHS } from "../db-paths";
import { DbNotFoundError, DbValidationError } from "../db.errors";
import { getUserNotificationsCollection } from "./notifications/notifications.db";
import { serializeNotification } from "./notifications/notifications.mapper";
import { normalizeUserDocument, serializeUser } from "./users.mapper";

const db = getAdminFirestore();

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
  const userDocRef = db.collection(DB_PATHS.USERS.COLLECTION).doc(uid);
  const userDocSnap = await userDocRef.get();

  if (!userDocSnap.exists) {
    throw new DbNotFoundError("User");
  }

  return userDocRef;
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

  const ref = db.collection(DB_PATHS.USERS.COLLECTION).doc(uid);
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
  const snap = await db.collection(DB_PATHS.USERS.COLLECTION).doc(uid).get();

  if (!snap.exists) return null;

  const data = snap.data()!;

  return normalizeUserDocument(data);
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
  let query: FirebaseFirestore.Query = db.collection(DB_PATHS.USERS.COLLECTION);

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
  const userDocRef = await getRequiredUserDocRefByUid(uid);

  await userDocRef.update({
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
  const userDocRef = await getRequiredUserDocRefByUid(uid);

  await userDocRef.update({ platform });
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

  const userDocRef = await getRequiredUserDocRefByUid(uid);

  await userDocRef.update({
    role,
    team,
    githubUsername,
  });
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
  const notificationRef = getUserNotificationsCollection(uid).doc();
  const batch = db.batch();

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

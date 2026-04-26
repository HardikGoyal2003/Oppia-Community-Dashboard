import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  ContributionPlatform,
  UserRole,
  UserModel,
} from "@/lib/auth/auth.types";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { TEAM_KEYS } from "@/lib/domain/team-definitions";
import { DB_PATHS } from "../db-paths";
import { DbValidationError } from "../db.errors";
import { getRequiredDocumentRef } from "../utils/document.utils";
import { getUserNotificationsCollection } from "./notifications/notifications.db";
import { serializeNotification } from "./notifications/notifications.mapper";
import { normalizeUserDocument, serializeUser } from "./users.mapper";
import type { FirestoreUser } from "./users.mapper";

const db = getAdminFirestore();
export const usersCollection = db.collection(
  DB_PATHS.USERS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreUser>;

export type UserRecord = UserModel & {
  id: string;
};

export type UserFilters = {
  role?: UserRole;
  team?: string;
  name?: string;
};

export type PaginatedUserRecords = {
  users: UserRecord[];
  nextCursor: string | null;
};

const DEFAULT_USER_PAGE_SIZE = 10;

type UserPageCursor = {
  createdAtMillis: number;
  fullName: string;
  id: string;
};

/**
 * Encodes the final document of a page into a cursor token.
 *
 * @param user The Firestore user document of the final item in the page.
 * @param id The Firestore document id of the final item in the page.
 * @returns The encoded cursor token.
 */
function encodeUserPageCursor(user: FirestoreUser, id: string): string {
  const payload: UserPageCursor = {
    createdAtMillis: user.createdAt.toMillis(),
    fullName: user.fullName,
    id,
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Decodes a cursor token into Firestore paging values.
 *
 * @param cursor The encoded cursor token from a previous page response.
 * @returns The decoded page cursor values for `startAfter`.
 */
function decodeUserPageCursor(cursor: string): UserPageCursor {
  let parsedCursor: Partial<UserPageCursor>;

  try {
    parsedCursor = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<UserPageCursor>;
  } catch {
    throw new DbValidationError("cursor", "Cursor is invalid.");
  }

  if (
    !parsedCursor ||
    typeof parsedCursor !== "object" ||
    !("createdAtMillis" in parsedCursor) ||
    !("fullName" in parsedCursor) ||
    !("id" in parsedCursor)
  ) {
    throw new DbValidationError("cursor", "Cursor is invalid.");
  }

  const { createdAtMillis, fullName, id } = parsedCursor;

  if (
    typeof createdAtMillis !== "number" ||
    !Number.isFinite(createdAtMillis) ||
    typeof fullName !== "string" ||
    typeof id !== "string" ||
    !id.trim()
  ) {
    throw new DbValidationError("cursor", "Cursor is invalid.");
  }

  return parsedCursor as UserPageCursor;
}

/**
 * Validates and normalizes the optional user query filters.
 *
 * @param filters The raw user query filters.
 * @returns The normalized query filters safe to apply to Firestore.
 */
function normalizeUserFilters(filters?: UserFilters): UserFilters {
  if (!filters) {
    return {};
  }

  const normalizedFilters: UserFilters = {};

  if (filters.role) {
    normalizedFilters.role = filters.role;
  }

  if (filters.team) {
    if (!TEAM_KEYS.includes(filters.team)) {
      throw new DbValidationError("team", "Team filter is invalid.");
    }

    normalizedFilters.team = filters.team;
  }

  if (filters.name) {
    const trimmedName = filters.name.trim();

    if (trimmedName) {
      normalizedFilters.name = trimmedName;
    }
  }

  return normalizedFilters;
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
  data: Omit<UserModel, "createdAt">,
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
  const users: UserRecord[] = [];
  let cursor: string | null = null;

  do {
    const page = await getUsersByPlatform(
      undefined,
      undefined,
      cursor,
      DEFAULT_USER_PAGE_SIZE,
    );
    users.push(...page.users);
    cursor = page.nextCursor;
  } while (cursor);

  return users;
}

/**
 * Retrieves users, optionally scoped to a contribution platform.
 *
 * @param platform The optional contribution platform filter.
 * @param filters The optional server-side filters for narrowing users.
 * @param cursor The optional cursor token for continuing from a previous page.
 * @param limit The requested page size, capped to the default maximum.
 * @returns The normalized user models with document ids attached.
 */
export async function getUsersByPlatform(
  platform?: ContributionPlatform,
  filters?: UserFilters,
  cursor?: string | null,
  limit = DEFAULT_USER_PAGE_SIZE,
): Promise<PaginatedUserRecords> {
  const normalizedFilters = normalizeUserFilters(filters);
  let query: FirebaseFirestore.Query<FirestoreUser> = usersCollection;

  if (platform) {
    query = query.where("platform", "==", platform);
  }

  if (normalizedFilters.role) {
    query = query.where("role", "==", normalizedFilters.role);
  }

  if (normalizedFilters.team) {
    query = query.where("team", "==", normalizedFilters.team);
  }

  if (normalizedFilters.name) {
    query = query
      .where("fullName", ">=", normalizedFilters.name)
      .where("fullName", "<=", `${normalizedFilters.name}\uf8ff`)
      .orderBy("fullName", "asc")
      .orderBy(FieldPath.documentId(), "asc");
  } else {
    query = query
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
  }

  if (cursor) {
    const decodedCursor = decodeUserPageCursor(cursor);
    query = normalizedFilters.name
      ? query.startAfter(decodedCursor.fullName, decodedCursor.id)
      : query.startAfter(
          Timestamp.fromMillis(decodedCursor.createdAtMillis),
          decodedCursor.id,
        );
  }

  const safeLimit = Math.max(1, Math.min(limit, DEFAULT_USER_PAGE_SIZE));
  const snap = await query.limit(safeLimit + 1).get();

  const pageDocs = snap.docs.slice(0, safeLimit);
  const hasNextPage = snap.docs.length > safeLimit;
  const lastVisibleDoc = pageDocs.at(-1);

  return {
    users: pageDocs.map((doc) => {
      return {
        id: doc.id,
        ...normalizeUserDocument(doc.data()),
      };
    }),
    nextCursor:
      hasNextPage && lastVisibleDoc
        ? encodeUserPageCursor(lastVisibleDoc.data(), lastVisibleDoc.id)
        : null,
  };
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

import {
  ContributionPlatform,
  UserRole,
  UserModel,
  isContributionPlatform,
} from "@/lib/auth/auth.types";
import {
  isAssignableUserRole,
  isTeamLeadAssignableRole,
} from "@/lib/auth/roles";
import { Timestamp } from "firebase-admin/firestore";
import { DbAuthorizationError, DbValidationError } from "../db.errors";
import { chunkValues, FIRESTORE_WRITE_BATCH_SIZE } from "../utils/batch.utils";
import {
  getRequiredTransactionDocumentSnapshot,
  updateRequiredDocument,
} from "../utils/document.utils";
import {
  getRequiredUserDocRefInTransaction,
  getUserNotificationsCollection,
  usersCollection,
} from "./users.refs";
import { serializeNotification } from "./notifications/notifications.mapper";
import { normalizeUserDocument, serializeUser } from "./users.mapper";
import type { FirestoreUser } from "./users.mapper";

/** Actor context required to authorize user role/team updates. */
export type UpdateUserRoleAndTeamActor = {
  role: UserRole;
  team: string | null;
};

const TEAM_LEAD_UNMANAGEABLE_TARGET_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEAM_LEAD",
];

export type UserRecord = UserModel & {
  id: string;
};

/**
 * Validates that a GitHub username is provided.
 *
 * @param githubUsername The GitHub username associated with the user.
 * @returns Nothing. Throws when the GitHub username is missing or blank.
 */
function assertGithubUsernameProvided(githubUsername: string) {
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
  assertGithubUsernameProvided(data.githubUsername);

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
  let query: FirebaseFirestore.Query<FirestoreUser> = usersCollection;

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
  for (const chunk of chunkValues(updates, FIRESTORE_WRITE_BATCH_SIZE)) {
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
  if (!isContributionPlatform(platform)) {
    throw new DbValidationError("platform", "platform must be WEB or ANDROID.");
  }

  await updateRequiredDocument("User", usersCollection.doc(uid), { platform });
}

/**
 * Asserts that an actor may update a user's role and team.
 *
 * @param actor The actor attempting the update.
 * @param target The current target user record.
 * @param role The requested role.
 * @param team The requested team.
 * @returns Nothing. Throws when the actor is not authorized.
 */
function assertCanUpdateUserRoleAndTeam(
  actor: UpdateUserRoleAndTeamActor,
  target: UserRecord,
  role: UserRole,
  team: string | null,
): void {
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
    if (!isAssignableUserRole(role)) {
      throw new DbValidationError("role", "Invalid payload for user update.");
    }
    return;
  }

  if (actor.role === "TEAM_LEAD" || actor.role === "LEAD_TRAINEE") {
    if (!actor.team) {
      throw new DbAuthorizationError("You are not assigned to any team.");
    }

    if (!isAssignableUserRole(role) || !isTeamLeadAssignableRole(role)) {
      throw new DbAuthorizationError(
        "You do not have permission to assign this role.",
      );
    }

    if (team && team !== actor.team) {
      throw new DbAuthorizationError(
        "You do not have permission to assign users to another team.",
      );
    }

    if (target.team !== actor.team) {
      throw new DbAuthorizationError(
        "You do not have permission to update users outside your team.",
      );
    }

    if (TEAM_LEAD_UNMANAGEABLE_TARGET_ROLES.includes(target.role)) {
      throw new DbAuthorizationError(
        "You do not have permission to update this user.",
      );
    }

    return;
  }

  throw new DbAuthorizationError();
}

/**
 * Updates a user's role and team by uid and appends a notification atomically.
 *
 * Authorization is re-checked inside the transaction against the current target
 * user state.
 *
 * @param uid The user id to update.
 * @param role The new role value.
 * @param team The new team value.
 * @param githubUsername The GitHub username to persist.
 * @param message The notification message to append.
 * @param actor The actor performing the update.
 * @returns A promise that resolves when the update and notification write have been committed.
 */
export async function updateUserRoleAndTeamWithNotificationByUid(
  uid: string,
  role: UserRole,
  team: string | null,
  githubUsername: string,
  message: string,
  actor: UpdateUserRoleAndTeamActor,
): Promise<void> {
  assertGithubUsernameProvided(githubUsername);

  await usersCollection.firestore.runTransaction(async (tx) => {
    const userDocRef = usersCollection.doc(uid);
    const snapshot = await getRequiredTransactionDocumentSnapshot(
      tx,
      "User",
      userDocRef,
    );
    const target: UserRecord = {
      id: snapshot.id,
      ...normalizeUserDocument(snapshot.data()!),
    };

    assertCanUpdateUserRoleAndTeam(actor, target, role, team);

    const effectiveTeam =
      actor.role === "TEAM_LEAD" || actor.role === "LEAD_TRAINEE"
        ? actor.team
        : team;

    tx.update(userDocRef, {
      role,
      team: effectiveTeam,
      githubUsername,
    });
    appendNotificationInTransaction(tx, userDocRef, message);
  });
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
  userDocRef: FirebaseFirestore.DocumentReference<FirestoreUser>,
  message: string,
): void {
  tx.set(
    getUserNotificationsCollection(userDocRef).doc(),
    serializeNotification({
      message,
      read: false,
      createdAt: new Date(),
    }),
  );
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
  assertGithubUsernameProvided(githubUsername);

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

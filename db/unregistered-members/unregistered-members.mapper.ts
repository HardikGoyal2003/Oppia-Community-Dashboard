import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";
import {
  assertTimestamp,
  normalizeTimestamp,
  toFirestoreTimestamp,
} from "@/db/utils/timestamp.utils";
import { isContributionPlatform } from "@/lib/auth/auth.types";
import { normalizeGithubUsername } from "@/lib/utils/username.utils";
import type {
  UnregisteredMemberModel,
  UnregisteredMemberWrite,
} from "@/db/unregistered-members/unregistered-members.types";

export type FirestoreUnregisteredMember = Omit<
  UnregisteredMemberModel,
  "createdAt" | "updatedAt"
> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * Validates a raw Firestore missing-person document.
 *
 * @param document The raw document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreUnregisteredMember(
  document: FirebaseFirestore.DocumentData,
): asserts document is FirestoreUnregisteredMember {
  if (typeof document.teamKey !== "string" || !document.teamKey.trim()) {
    throw new DbValidationError(
      "teamKey",
      "teamKey must be a non-empty string.",
    );
  }

  if (!isContributionPlatform(document.platform)) {
    throw new DbValidationError("platform", "platform must be WEB or ANDROID.");
  }

  for (const field of ["githubUsername", "email", "fullName"] as const) {
    if (typeof document[field] !== "string") {
      throw new DbValidationError(field, `${field} must be a string.`);
    }
  }

  assertTimestamp("Unregistered member", "createdAt", document.createdAt);
  assertTimestamp("Unregistered member", "updatedAt", document.updatedAt);
  assertSchemaVersion(SCHEMA_KEYS.UNREGISTERED_MEMBERS, document.schemaVersion);
}

/**
 * Normalizes a stored missing-person document into the app-layer model.
 *
 * @param document The raw Firestore document data.
 * @returns The normalized model.
 */
export function normalizeUnregisteredMemberDocument(
  document: FirebaseFirestore.DocumentData,
): UnregisteredMemberModel {
  const migrated = migrateDocument(SCHEMA_KEYS.UNREGISTERED_MEMBERS, document);
  assertFirestoreUnregisteredMember(migrated);

  return {
    teamKey: migrated.teamKey,
    platform: migrated.platform,
    githubUsername: migrated.githubUsername,
    email: migrated.email,
    fullName: migrated.fullName,
    createdAt: normalizeTimestamp(migrated.createdAt),
    updatedAt: normalizeTimestamp(migrated.updatedAt),
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Normalizes a stored missing-person document together with its id.
 *
 * @param id The Firestore document id.
 * @param document The raw Firestore document data.
 * @returns The normalized record.
 */
export function normalizeUnregisteredMemberRecord(
  id: string,
  document: FirebaseFirestore.DocumentData,
) {
  return {
    id,
    ...normalizeUnregisteredMemberDocument(document),
  };
}

/**
 * Validates and serializes a missing-person model for Firestore storage.
 *
 * @param member The model to persist.
 * @returns The Firestore-ready document.
 */
export function serializeUnregisteredMember(
  member: UnregisteredMemberWrite,
): FirestoreUnregisteredMember {
  const normalizedUsername = normalizeGithubUsername(member.githubUsername);
  const expectedId = `${member.teamKey}__${normalizedUsername}`;

  if (member.id !== expectedId) {
    throw new DbValidationError(
      "id",
      "Unregistered member id must match its team key and GitHub username.",
    );
  }

  return {
    teamKey: member.teamKey,
    platform: member.platform,
    githubUsername: member.githubUsername,
    email: member.email,
    fullName: member.fullName,
    createdAt: toFirestoreTimestamp(member.createdAt),
    updatedAt: toFirestoreTimestamp(member.updatedAt),
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.UNREGISTERED_MEMBERS),
  };
}

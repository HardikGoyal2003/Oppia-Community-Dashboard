import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";
import {
  assertOptionalTimestamp,
  assertTimestamp,
  normalizeTimestamp,
  toFirestoreTimestamp,
} from "@/db/utils/timestamp.utils";
import { isContributionPlatform } from "@/lib/auth/auth.types";
import type {
  UnregisteredMemberModel,
  UnregisteredMemberReason,
  UnregisteredMemberResolution,
  UnregisteredMemberState,
  UnregisteredMemberWrite,
} from "@/db/unregistered-members/unregistered-members.types";

const REASONS: readonly UnregisteredMemberReason[] = [
  "NOT_REGISTERED",
  "ALUMNI_ACCOUNT",
];
const STATES: readonly UnregisteredMemberState[] = ["OPEN", "RESOLVED"];
const RESOLUTIONS: readonly UnregisteredMemberResolution[] = [
  "REGISTERED",
  "LEFT_ROSTER",
];

export type FirestoreUnregisteredMember = Omit<
  UnregisteredMemberModel,
  "createdAt" | "updatedAt" | "resolvedAt"
> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt: Timestamp | null;
};

/**
 * Validates a raw Firestore roster-gap document.
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

  for (const field of [
    "githubUsername",
    "normalizedUsername",
    "email",
    "fullName",
    "sheetStatus",
  ] as const) {
    if (typeof document[field] !== "string") {
      throw new DbValidationError(field, `${field} must be a string.`);
    }
  }

  if (!REASONS.includes(document.reason)) {
    throw new DbValidationError(
      "reason",
      "Invalid unregistered-member reason.",
    );
  }

  if (!STATES.includes(document.state)) {
    throw new DbValidationError("state", "Invalid unregistered-member state.");
  }

  if (
    document.resolution !== null &&
    !RESOLUTIONS.includes(document.resolution)
  ) {
    throw new DbValidationError(
      "resolution",
      "Invalid unregistered-member resolution.",
    );
  }

  assertTimestamp("Unregistered member", "createdAt", document.createdAt);
  assertTimestamp("Unregistered member", "updatedAt", document.updatedAt);
  assertOptionalTimestamp(
    "Unregistered member",
    "resolvedAt",
    document.resolvedAt,
  );
  assertSchemaVersion(SCHEMA_KEYS.UNREGISTERED_MEMBERS, document.schemaVersion);
}

/**
 * Normalizes a stored roster-gap document into the app-layer model.
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
    normalizedUsername: migrated.normalizedUsername,
    email: migrated.email,
    fullName: migrated.fullName,
    sheetStatus: migrated.sheetStatus,
    reason: migrated.reason,
    state: migrated.state,
    createdAt: normalizeTimestamp(migrated.createdAt),
    updatedAt: normalizeTimestamp(migrated.updatedAt),
    resolvedAt: migrated.resolvedAt
      ? normalizeTimestamp(migrated.resolvedAt)
      : null,
    resolution: migrated.resolution,
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Normalizes a stored roster-gap document together with its id.
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
 * Validates and serializes a roster-gap model for Firestore storage.
 *
 * @param member The model to persist.
 * @returns The Firestore-ready document.
 */
export function serializeUnregisteredMember(
  member: UnregisteredMemberWrite,
): FirestoreUnregisteredMember {
  const expectedId = `${member.teamKey}__${member.normalizedUsername}`;

  if (member.id !== expectedId) {
    throw new DbValidationError(
      "id",
      "Unregistered member id must match its team key and normalized username.",
    );
  }

  return {
    teamKey: member.teamKey,
    platform: member.platform,
    githubUsername: member.githubUsername,
    normalizedUsername: member.normalizedUsername,
    email: member.email,
    fullName: member.fullName,
    sheetStatus: member.sheetStatus,
    reason: member.reason,
    state: member.state,
    createdAt: toFirestoreTimestamp(member.createdAt),
    updatedAt: toFirestoreTimestamp(member.updatedAt),
    resolvedAt: member.resolvedAt
      ? toFirestoreTimestamp(member.resolvedAt)
      : null,
    resolution: member.resolution,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.UNREGISTERED_MEMBERS),
  };
}

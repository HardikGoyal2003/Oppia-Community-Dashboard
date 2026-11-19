import { parseDateValue } from "@/lib/utils/date.utils";
import { Timestamp } from "firebase-admin/firestore";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Discussion } from "@/lib/domain/discussions.types";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

export type ArchiveDiscussionInput = {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  createdAt: string;
};

/**
 * Validates that a value is a positive integer.
 *
 * @param field The field name being validated.
 * @param value The value to validate.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertPositiveInteger(
  field: string,
  value: number | string | boolean | object | null | undefined,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new DbValidationError(field, `${field} must be a positive integer.`);
  }
}

/**
 * Validates that a value is an HTTP(S) URL string.
 *
 * @param field The field name being validated.
 * @param value The value to validate.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertUrlShape(
  field: string,
  value: number | string | boolean | object | null | undefined,
): asserts value is string {
  if (typeof value !== "string") {
    throw new DbValidationError(field, `${field} must be a valid URL.`);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new DbValidationError(field, `${field} must be a valid URL.`);
  }
}

/**
 * Validates archived discussion input at the DB boundary.
 *
 * @param discussion The archived discussion input to validate.
 * @returns Nothing. Throws when the input is invalid.
 */
export function assertArchiveDiscussionInput(
  discussion: ArchiveDiscussionInput,
): void {
  assertPositiveInteger("discussionNumber", discussion.discussionNumber);
  assertUrlShape("discussionUrl", discussion.discussionUrl);
  if (
    typeof discussion.discussionTitle !== "string" ||
    !discussion.discussionTitle.trim()
  ) {
    throw new DbValidationError(
      "discussionTitle",
      "discussionTitle must be a non-empty string.",
    );
  }
  if (typeof discussion.createdAt !== "string") {
    throw new DbValidationError(
      "createdAt",
      "createdAt must be a valid date string.",
    );
  }
}

export type FirestoreArchivedDiscussion = {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  createdAt: Timestamp;
  platform: ContributionPlatform;
  archivedBy?: string;
  archivedAt?: Timestamp;
  schemaVersion: number;
};

export type ArchivedDiscussionRecord = Discussion & {
  platform: ContributionPlatform;
  schemaVersion: number;
};

/**
 * Validates the raw Firestore archived-discussion document shape.
 *
 * @param discussion The raw Firestore archived-discussion document data.
 * @returns Nothing. Throws when the archived-discussion document shape is invalid.
 */
function assertFirestoreArchivedDiscussion(
  discussion: FirebaseFirestore.DocumentData,
): asserts discussion is FirestoreArchivedDiscussion {
  if (typeof discussion.discussionNumber !== "number") {
    throw new DbValidationError(
      "discussionNumber",
      "Archived discussion discussionNumber must be a number.",
    );
  }

  if (typeof discussion.discussionUrl !== "string") {
    throw new DbValidationError(
      "discussionUrl",
      "Archived discussion discussionUrl must be a string.",
    );
  }

  if (typeof discussion.discussionTitle !== "string") {
    throw new DbValidationError(
      "discussionTitle",
      "Archived discussion discussionTitle must be a string.",
    );
  }

  assertTimestamp("Archived discussion", "createdAt", discussion.createdAt);

  if (discussion.platform !== "WEB" && discussion.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Archived discussion platform must be WEB or ANDROID.",
    );
  }

  if (
    discussion.archivedBy !== undefined &&
    typeof discussion.archivedBy !== "string"
  ) {
    throw new DbValidationError(
      "archivedBy",
      "Archived discussion archivedBy must be a string.",
    );
  }

  if (discussion.archivedAt !== undefined) {
    assertTimestamp("Archived discussion", "archivedAt", discussion.archivedAt);
  }
}

/**
 * Converts a validated Firestore archived-discussion document into the app model.
 *
 * @param discussion The validated Firestore archived-discussion document.
 * @returns The normalized archived-discussion record.
 */
function normalizeArchivedDiscussion(
  discussion: FirestoreArchivedDiscussion,
): ArchivedDiscussionRecord {
  return {
    discussionNumber: discussion.discussionNumber,
    discussionUrl: discussion.discussionUrl,
    discussionTitle: discussion.discussionTitle,
    isArchived: true,
    createdAt: normalizeTimestamp(discussion.createdAt).toISOString(),
    platform: discussion.platform,
    archivedBy: discussion.archivedBy,
    archivedAt: discussion.archivedAt
      ? normalizeTimestamp(discussion.archivedAt).toISOString()
      : undefined,
    schemaVersion: discussion.schemaVersion,
  };
}

/**
 * Normalizes raw Firestore archived-discussion document data into the app model.
 *
 * @param discussion The raw Firestore archived-discussion document data.
 * @returns The normalized archived-discussion model.
 */
export function normalizeArchivedDiscussionDocument(
  discussion: FirebaseFirestore.DocumentData,
): ArchivedDiscussionRecord {
  const migratedDiscussion = migrateDocument(
    SCHEMA_KEYS.ARCHIVED_DISCUSSIONS,
    discussion,
  );
  assertFirestoreArchivedDiscussion(migratedDiscussion);
  return normalizeArchivedDiscussion(migratedDiscussion);
}

/**
 * Serializes an archived discussion for Firestore storage.
 *
 * @param discussion The validated archived discussion input.
 * @param platform The contribution platform to persist.
 * @param archivedBy The GitHub username of the user who archived the discussion.
 * @param archivedAt The server-generated archive timestamp.
 * @returns The Firestore-ready archived discussion document.
 */
export function serializeArchivedDiscussion(
  discussion: ArchiveDiscussionInput,
  platform: ContributionPlatform,
  archivedBy: string,
  archivedAt: Date,
): FirestoreArchivedDiscussion {
  assertArchiveDiscussionInput(discussion);

  const createdAt = parseDateValue(discussion.createdAt);

  if (!createdAt) {
    throw new DbValidationError(
      "createdAt",
      "Archived discussion createdAt must be a valid date.",
    );
  }

  return {
    discussionNumber: discussion.discussionNumber,
    discussionUrl: discussion.discussionUrl,
    discussionTitle: discussion.discussionTitle,
    createdAt: Timestamp.fromDate(createdAt),
    platform,
    archivedBy,
    archivedAt: Timestamp.fromDate(archivedAt),
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.ARCHIVED_DISCUSSIONS),
  };
}

import { Timestamp } from "firebase-admin/firestore";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Discussion } from "@/lib/domain/discussions.types";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

export type FirestoreArchivedDiscussion = {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  isArchived?: boolean;
  lastCommentCreatedAt: Timestamp;
  platform: ContributionPlatform;
  archivedBy?: string;
  archivedAt?: Timestamp;
};

export type ArchivedDiscussionRecord = Discussion & {
  platform: ContributionPlatform;
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

  if (
    discussion.isArchived !== undefined &&
    typeof discussion.isArchived !== "boolean"
  ) {
    throw new DbValidationError(
      "isArchived",
      "Archived discussion isArchived must be a boolean.",
    );
  }

  assertTimestamp(
    "Archived discussion",
    "lastCommentCreatedAt",
    discussion.lastCommentCreatedAt,
  );

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
    lastCommentCreatedAt: normalizeTimestamp(
      discussion.lastCommentCreatedAt,
    ).toISOString(),
    platform: discussion.platform,
    archivedBy: discussion.archivedBy,
    archivedAt: discussion.archivedAt
      ? normalizeTimestamp(discussion.archivedAt).toISOString()
      : undefined,
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
  assertFirestoreArchivedDiscussion(discussion);
  return normalizeArchivedDiscussion(discussion);
}

/**
 * Serializes an archived discussion for Firestore storage.
 *
 * @param discussion The normalized archived discussion.
 * @param platform The contribution platform to persist.
 * @param archivedBy The GitHub username of the user who archived the discussion.
 * @returns The Firestore-ready archived discussion document.
 */
export function serializeArchivedDiscussion(
  discussion: Discussion,
  platform: ContributionPlatform,
  archivedBy: string,
): FirestoreArchivedDiscussion {
  return {
    discussionNumber: discussion.discussionNumber,
    discussionUrl: discussion.discussionUrl,
    discussionTitle: discussion.discussionTitle,
    lastCommentCreatedAt: Timestamp.fromDate(
      new Date(discussion.lastCommentCreatedAt),
    ),
    platform,
    archivedBy,
    archivedAt: Timestamp.now(),
  };
}

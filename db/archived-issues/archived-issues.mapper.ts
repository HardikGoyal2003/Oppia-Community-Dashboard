import { Timestamp } from "firebase-admin/firestore";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/lib/domain/issues.types";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

export type FirestoreArchivedIssue = Omit<Issue, "lastCommentCreatedAt"> & {
  lastCommentCreatedAt: Timestamp;
  platform: ContributionPlatform;
};

export type LegacyFirestoreArchivedIssue = Issue;

/**
 * Validates the raw Firestore archived-issue document shape.
 *
 * @param issue The raw Firestore archived-issue document data.
 * @returns Nothing. Throws when the archived-issue document shape is invalid.
 */
function assertFirestoreArchivedIssue(
  issue: FirebaseFirestore.DocumentData,
): asserts issue is FirestoreArchivedIssue {
  if (typeof issue.issueNumber !== "number") {
    throw new DbValidationError(
      "issueNumber",
      "Archived issue issueNumber must be a number.",
    );
  }

  if (typeof issue.issueUrl !== "string") {
    throw new DbValidationError(
      "issueUrl",
      "Archived issue issueUrl must be a string.",
    );
  }

  if (typeof issue.issueTitle !== "string") {
    throw new DbValidationError(
      "issueTitle",
      "Archived issue issueTitle must be a string.",
    );
  }

  if (typeof issue.isArchived !== "boolean") {
    throw new DbValidationError(
      "isArchived",
      "Archived issue isArchived must be a boolean.",
    );
  }

  assertTimestamp("lastCommentCreatedAt", issue.lastCommentCreatedAt);

  if (typeof issue.linkedProject !== "string") {
    throw new DbValidationError(
      "linkedProject",
      "Archived issue linkedProject must be a string.",
    );
  }

  if (issue.platform !== "WEB" && issue.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Archived issue platform must be WEB or ANDROID.",
    );
  }
}

/**
 * Validates the raw Firestore legacy archived-issue document shape.
 *
 * @param issue The raw Firestore legacy archived-issue document data.
 * @returns Nothing. Throws when the legacy archived-issue document shape is invalid.
 */
export function assertLegacyFirestoreArchivedIssue(
  issue: FirebaseFirestore.DocumentData,
): asserts issue is LegacyFirestoreArchivedIssue {
  if (typeof issue.issueNumber !== "number") {
    throw new DbValidationError(
      "issueNumber",
      "Legacy archived issue issueNumber must be a number.",
    );
  }

  if (typeof issue.issueUrl !== "string") {
    throw new DbValidationError(
      "issueUrl",
      "Legacy archived issue issueUrl must be a string.",
    );
  }

  if (typeof issue.issueTitle !== "string") {
    throw new DbValidationError(
      "issueTitle",
      "Legacy archived issue issueTitle must be a string.",
    );
  }

  if (typeof issue.isArchived !== "boolean") {
    throw new DbValidationError(
      "isArchived",
      "Legacy archived issue isArchived must be a boolean.",
    );
  }

  if (typeof issue.lastCommentCreatedAt !== "string") {
    throw new DbValidationError(
      "lastCommentCreatedAt",
      "Legacy archived issue lastCommentCreatedAt must be a string.",
    );
  }

  if (typeof issue.linkedProject !== "string") {
    throw new DbValidationError(
      "linkedProject",
      "Legacy archived issue linkedProject must be a string.",
    );
  }
}

/**
 * Normalizes a Firestore archived-issue document into the app model.
 *
 * @param issue The raw Firestore archived-issue document.
 * @returns The normalized archived-issue model.
 */
export function normalizeArchivedIssue(
  issue: FirestoreArchivedIssue,
): FirestoreArchivedIssue {
  return {
    issueNumber: issue.issueNumber,
    issueUrl: issue.issueUrl,
    issueTitle: issue.issueTitle,
    isArchived: issue.isArchived,
    lastCommentCreatedAt: Timestamp.fromDate(
      normalizeTimestamp(issue.lastCommentCreatedAt),
    ),
    linkedProject: issue.linkedProject,
    platform: issue.platform,
  };
}

/**
 * Normalizes raw Firestore archived-issue document data into the app model.
 *
 * @param issue The raw Firestore archived-issue document data.
 * @returns The normalized archived-issue model.
 */
export function normalizeArchivedIssueDocument(
  issue: FirebaseFirestore.DocumentData,
): Issue & { platform: ContributionPlatform } {
  assertFirestoreArchivedIssue(issue);
  const normalized = normalizeArchivedIssue(issue);

  return {
    issueNumber: normalized.issueNumber,
    issueUrl: normalized.issueUrl,
    issueTitle: normalized.issueTitle,
    isArchived: normalized.isArchived,
    lastCommentCreatedAt: normalizeTimestamp(
      normalized.lastCommentCreatedAt,
    ).toISOString(),
    linkedProject: normalized.linkedProject,
    platform: normalized.platform,
  };
}

/**
 * Serializes an archived issue for Firestore storage.
 *
 * @param issue The normalized archived issue.
 * @param platform The contribution platform to persist.
 * @returns The Firestore-ready archived issue document.
 */
export function serializeArchivedIssue(
  issue: Issue,
  platform: ContributionPlatform,
): FirestoreArchivedIssue {
  return {
    issueNumber: issue.issueNumber,
    issueUrl: issue.issueUrl,
    issueTitle: issue.issueTitle,
    isArchived: issue.isArchived,
    lastCommentCreatedAt: Timestamp.fromDate(
      new Date(issue.lastCommentCreatedAt),
    ),
    linkedProject: issue.linkedProject,
    platform,
  };
}

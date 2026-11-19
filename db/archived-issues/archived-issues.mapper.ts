import { parseDateValue } from "@/lib/utils/date.utils";
import { Timestamp } from "firebase-admin/firestore";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/lib/domain/issues.types";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  assertHttpUrl,
  assertNonEmptyString,
  assertPositiveInteger,
} from "@/db/utils/validation.utils";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

export type ArchiveIssueInput = {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  lastCommentCreatedAt: string;
  linkedProject: string;
};

/**
 * Validates archived issue input at the DB boundary.
 *
 * @param issue The archived issue input to validate.
 * @returns Nothing. Throws when the input is invalid.
 */
export function assertArchiveIssueInput(issue: ArchiveIssueInput): void {
  assertPositiveInteger("issueNumber", issue.issueNumber);
  assertHttpUrl("issueUrl", issue.issueUrl);
  assertNonEmptyString("issueTitle", issue.issueTitle);
  if (typeof issue.lastCommentCreatedAt !== "string") {
    throw new DbValidationError(
      "lastCommentCreatedAt",
      "lastCommentCreatedAt must be a valid date string.",
    );
  }
  if (typeof issue.linkedProject !== "string") {
    throw new DbValidationError(
      "linkedProject",
      "linkedProject must be a string.",
    );
  }
}

export type FirestoreArchivedIssue = {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  lastCommentCreatedAt: Timestamp;
  linkedProject: string;
  platform: ContributionPlatform;
  archivedBy: string;
  archivedAt?: Timestamp;
  schemaVersion: number;
};

export type ArchivedIssueRecord = Issue & {
  platform: ContributionPlatform;
  archivedBy: string;
  schemaVersion: number;
};

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

  assertTimestamp(
    "Archived issue",
    "lastCommentCreatedAt",
    issue.lastCommentCreatedAt,
  );

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

  if (typeof issue.archivedBy !== "string") {
    throw new DbValidationError(
      "archivedBy",
      "Archived issue archivedBy must be a string.",
    );
  }

  if (issue.archivedAt !== undefined) {
    assertTimestamp("Archived issue", "archivedAt", issue.archivedAt);
  }
}

/**
 * Converts a validated Firestore archived-issue document into the app model.
 *
 * @param issue The validated Firestore archived-issue document.
 * @returns The normalized archived-issue record.
 */
function normalizeArchivedIssue(
  issue: FirestoreArchivedIssue,
): ArchivedIssueRecord {
  return {
    issueNumber: issue.issueNumber,
    issueUrl: issue.issueUrl,
    issueTitle: issue.issueTitle,
    isArchived: true,
    lastCommentCreatedAt: normalizeTimestamp(
      issue.lastCommentCreatedAt,
    ).toISOString(),
    linkedProject: issue.linkedProject,
    platform: issue.platform,
    archivedBy: issue.archivedBy,
    archivedAt: issue.archivedAt
      ? normalizeTimestamp(issue.archivedAt).toISOString()
      : undefined,
    schemaVersion: issue.schemaVersion,
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
): ArchivedIssueRecord {
  const migratedIssue = migrateDocument(SCHEMA_KEYS.ARCHIVED_ISSUES, issue);
  assertFirestoreArchivedIssue(migratedIssue);
  return normalizeArchivedIssue(migratedIssue);
}

/**
 * Serializes an archived issue for Firestore storage.
 *
 * @param issue The validated archived issue input.
 * @param platform The contribution platform to persist.
 * @param archivedBy The GitHub username of the user who archived the issue.
 * @param archivedAt The server-generated archive timestamp.
 * @returns The Firestore-ready archived issue document.
 */
export function serializeArchivedIssue(
  issue: ArchiveIssueInput,
  platform: ContributionPlatform,
  archivedBy: string,
  archivedAt: Date,
): FirestoreArchivedIssue {
  assertArchiveIssueInput(issue);

  const lastCommentCreatedAt = parseDateValue(issue.lastCommentCreatedAt);

  if (!lastCommentCreatedAt) {
    throw new DbValidationError(
      "lastCommentCreatedAt",
      "Archived issue lastCommentCreatedAt must be a valid date.",
    );
  }

  return {
    issueNumber: issue.issueNumber,
    issueUrl: issue.issueUrl,
    issueTitle: issue.issueTitle,
    lastCommentCreatedAt: Timestamp.fromDate(lastCommentCreatedAt),
    linkedProject: issue.linkedProject,
    platform,
    archivedBy,
    archivedAt: Timestamp.fromDate(archivedAt),
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.ARCHIVED_ISSUES),
  };
}

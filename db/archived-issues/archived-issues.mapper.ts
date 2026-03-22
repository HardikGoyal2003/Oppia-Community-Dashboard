import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/lib/domain/issues.types";

export type FirestoreArchivedIssue = Issue & {
  platform: ContributionPlatform;
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
    throw new Error("Archived issue issueNumber must be a number.");
  }

  if (typeof issue.issueUrl !== "string") {
    throw new Error("Archived issue issueUrl must be a string.");
  }

  if (typeof issue.issueTitle !== "string") {
    throw new Error("Archived issue issueTitle must be a string.");
  }

  if (typeof issue.isArchived !== "boolean") {
    throw new Error("Archived issue isArchived must be a boolean.");
  }

  if (typeof issue.lastCommentCreatedAt !== "string") {
    throw new Error("Archived issue lastCommentCreatedAt must be a string.");
  }

  if (typeof issue.linkedProject !== "string") {
    throw new Error("Archived issue linkedProject must be a string.");
  }

  if (issue.platform !== "WEB" && issue.platform !== "ANDROID") {
    throw new Error("Archived issue platform must be WEB or ANDROID.");
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
    lastCommentCreatedAt: issue.lastCommentCreatedAt,
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
): FirestoreArchivedIssue {
  assertFirestoreArchivedIssue(issue);
  return normalizeArchivedIssue(issue);
}

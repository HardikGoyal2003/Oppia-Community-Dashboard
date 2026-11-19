import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DbValidationError } from "@/db/db.errors";
import { DB_PATHS } from "../db-paths";
import {
  type ArchiveIssueInput,
  type ArchivedIssueRecord,
  type FirestoreArchivedIssue,
  assertArchiveIssueInput,
  normalizeArchivedIssueDocument,
  serializeArchivedIssue,
} from "./archived-issues.mapper";

const db = getAdminFirestore();
const archivedIssuesCollection = db.collection(
  DB_PATHS.ARCHIVED_ISSUES.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreArchivedIssue>;

/**
 * Builds the archived issue document id for a platform-specific issue record.
 *
 * @param platform The contribution platform that owns the archived issue.
 * @param issueNumber The GitHub issue number.
 * @returns The Firestore document id for the archived issue.
 */
function getArchivedIssueDocId(
  platform: ContributionPlatform,
  issueNumber: number,
): string {
  return `${platform}_${issueNumber}`;
}

/**
 * Retrieves archived issues for a single contribution platform.
 *
 * @param platform The contribution platform to filter by.
 * @returns The archived issue records stored for the platform.
 */
export async function getArchivedIssues(
  platform: ContributionPlatform,
): Promise<ArchivedIssueRecord[]> {
  const snapshot = await archivedIssuesCollection
    .where("platform", "==", platform)
    .get();

  return snapshot.docs.map((docSnap) =>
    normalizeArchivedIssueDocument(docSnap.data()),
  );
}

/**
 * Stores an issue as archived for the given platform.
 *
 * @param issue The issue to archive.
 * @param platform The contribution platform that owns the archive entry.
 * @param archivedBy The GitHub username of the user who archived the issue.
 * @returns A promise that resolves when the archive record has been written.
 */
export async function archiveIssue(
  issue: ArchiveIssueInput,
  platform: ContributionPlatform,
  archivedBy: string,
): Promise<void> {
  assertArchiveIssueInput(issue);
  if (typeof archivedBy !== "string" || !archivedBy.trim()) {
    throw new DbValidationError(
      "archivedBy",
      "archivedBy must be a non-empty string.",
    );
  }

  await archivedIssuesCollection
    .doc(getArchivedIssueDocId(platform, issue.issueNumber))
    .set(serializeArchivedIssue(issue, platform, archivedBy, new Date()));
}

/**
 * Removes an archived issue record for the given platform.
 *
 * @param issueNumber The GitHub issue number to unarchive.
 * @param platform The contribution platform that owns the archive entry.
 * @returns A promise that resolves when the archive record has been deleted.
 */
export async function unarchiveIssue(
  issueNumber: number,
  platform: ContributionPlatform,
): Promise<void> {
  if (
    typeof issueNumber !== "number" ||
    !Number.isInteger(issueNumber) ||
    issueNumber <= 0
  ) {
    throw new DbValidationError(
      "issueNumber",
      "issueNumber must be a positive integer.",
    );
  }

  await archivedIssuesCollection
    .doc(getArchivedIssueDocId(platform, issueNumber))
    .delete();
}

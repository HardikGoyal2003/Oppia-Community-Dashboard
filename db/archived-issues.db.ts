import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { Issue } from "@/features/dashboard/dashboard.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "./db-paths";
import {
  FirestoreArchivedIssue,
  normalizeArchivedIssueDocument,
} from "./archived-issues.mapper";

const db = getAdminFirestore();

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
): Promise<FirestoreArchivedIssue[]> {
  const snapshot = await db
    .collection(DB_PATHS.ARCHIVED_ISSUES.COLLECTION)
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
 * @returns A promise that resolves when the archive record has been written.
 */
export async function archiveIssue(
  issue: Issue,
  platform: ContributionPlatform,
): Promise<void> {
  await db
    .collection(DB_PATHS.ARCHIVED_ISSUES.COLLECTION)
    .doc(getArchivedIssueDocId(platform, issue.issueNumber))
    .set({
      ...issue,
      platform,
      isArchived: true,
    });
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
  await db
    .collection(DB_PATHS.ARCHIVED_ISSUES.COLLECTION)
    .doc(getArchivedIssueDocId(platform, issueNumber))
    .delete();
}

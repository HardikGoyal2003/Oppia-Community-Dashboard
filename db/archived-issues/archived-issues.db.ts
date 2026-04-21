import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { Issue } from "@/lib/domain/issues.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "../db-paths";
import {
  type ArchivedIssueRecord,
  type FirestoreArchivedIssue,
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
export function getArchivedIssueDocId(
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
 * @returns A promise that resolves when the archive record has been written.
 */
export async function archiveIssue(
  issue: Issue,
  platform: ContributionPlatform,
): Promise<void> {
  await archivedIssuesCollection
    .doc(getArchivedIssueDocId(platform, issue.issueNumber))
    .set(serializeArchivedIssue({ ...issue, isArchived: true }, platform));
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
  await archivedIssuesCollection
    .doc(getArchivedIssueDocId(platform, issueNumber))
    .delete();
}

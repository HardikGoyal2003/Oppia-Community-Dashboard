import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { Issue } from "@/lib/domain/issues.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "../db-paths";
import { DbInvalidStateError, DbNotFoundError } from "../db.errors";
import {
  type FirestoreArchivedIssue,
  assertLegacyFirestoreArchivedIssue,
  normalizeArchivedIssueDocument,
  serializeArchivedIssue,
} from "./archived-issues.mapper";

const db = getAdminFirestore();
const archivedIssuesCollection = db.collection(
  DB_PATHS.ARCHIVED_ISSUES.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreArchivedIssue>;

export type LegacyArchivedIssueRecord = Issue & {
  id: string;
};

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
): Promise<(Issue & { platform: ContributionPlatform })[]> {
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

/**
 * Lists legacy archived issues that still use the old `${issueNumber}` document id scheme.
 *
 * @returns The legacy archived issue records with their current document ids.
 */
export async function listLegacyArchivedIssues(): Promise<
  LegacyArchivedIssueRecord[]
> {
  const snapshot = await archivedIssuesCollection.get();

  return snapshot.docs
    .filter((doc) => !doc.id.includes("_"))
    .map((doc) => {
      const data = doc.data();
      assertLegacyFirestoreArchivedIssue(data);

      return {
        id: doc.id,
        issueNumber: data.issueNumber,
        issueUrl: data.issueUrl,
        issueTitle: data.issueTitle,
        isArchived: data.isArchived,
        lastCommentCreatedAt: data.lastCommentCreatedAt,
        linkedProject: data.linkedProject,
      };
    });
}

/**
 * Lists all archived issue document ids in the collection.
 *
 * @returns The archived issue document ids.
 */
export async function listArchivedIssueDocumentIds(): Promise<string[]> {
  const snapshot = await archivedIssuesCollection.get();
  return snapshot.docs.map((doc) => doc.id);
}

/**
 * Migrates one legacy archived-issue document into the platform-scoped schema.
 *
 * @param legacyRecord The legacy archived issue record to migrate.
 * @param platform The platform to persist on the migrated record.
 * @returns A promise that resolves when the migration has been committed.
 */
export async function migrateLegacyArchivedIssue(
  legacyRecord: LegacyArchivedIssueRecord,
  platform: ContributionPlatform,
): Promise<void> {
  const oldDocRef = archivedIssuesCollection.doc(legacyRecord.id);
  const newDocRef = archivedIssuesCollection.doc(
    getArchivedIssueDocId(platform, legacyRecord.issueNumber),
  );

  await db.runTransaction(async (tx) => {
    const [oldSnapshot, newSnapshot] = await Promise.all([
      tx.get(oldDocRef),
      tx.get(newDocRef),
    ]);

    if (!oldSnapshot.exists) {
      throw new DbNotFoundError("Legacy archived issue");
    }

    if (newSnapshot.exists) {
      throw new DbInvalidStateError(
        "Archived issue migration",
        `Archived issue ${newDocRef.id} already exists.`,
      );
    }

    tx.set(
      newDocRef,
      serializeArchivedIssue(
        {
          issueNumber: legacyRecord.issueNumber,
          issueUrl: legacyRecord.issueUrl,
          issueTitle: legacyRecord.issueTitle,
          isArchived: legacyRecord.isArchived,
          lastCommentCreatedAt: legacyRecord.lastCommentCreatedAt,
          linkedProject: legacyRecord.linkedProject,
        },
        platform,
      ),
    );
    tx.delete(oldDocRef);
  });
}

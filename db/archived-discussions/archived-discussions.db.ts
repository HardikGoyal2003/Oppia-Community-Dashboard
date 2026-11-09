import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { Discussion } from "@/lib/domain/discussions.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "../db-paths";
import {
  type ArchivedDiscussionRecord,
  type FirestoreArchivedDiscussion,
  normalizeArchivedDiscussionDocument,
  serializeArchivedDiscussion,
} from "./archived-discussions.mapper";

const db = getAdminFirestore();
const archivedDiscussionsCollection = db.collection(
  DB_PATHS.ARCHIVED_DISCUSSIONS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreArchivedDiscussion>;

/**
 * Builds the archived discussion document id for a platform-specific discussion record.
 *
 * @param platform The contribution platform that owns the archived discussion.
 * @param discussionNumber The GitHub discussion number.
 * @returns The Firestore document id for the archived discussion.
 */
export function getArchivedDiscussionDocId(
  platform: ContributionPlatform,
  discussionNumber: number,
): string {
  return `${platform}_${discussionNumber}`;
}

/**
 * Retrieves archived discussions for a single contribution platform.
 *
 * @param platform The contribution platform to filter by.
 * @returns The archived discussion records stored for the platform.
 */
export async function getArchivedDiscussions(
  platform: ContributionPlatform,
): Promise<ArchivedDiscussionRecord[]> {
  const snapshot = await archivedDiscussionsCollection
    .where("platform", "==", platform)
    .get();

  return snapshot.docs.map((docSnap) =>
    normalizeArchivedDiscussionDocument(docSnap.data()),
  );
}

/**
 * Stores a discussion as archived for the given platform.
 *
 * @param discussion The discussion to archive.
 * @param platform The contribution platform that owns the archive entry.
 * @param archivedBy The GitHub username of the user who archived the discussion.
 * @returns A promise that resolves when the archive record has been written.
 */
export async function archiveDiscussion(
  discussion: Discussion,
  platform: ContributionPlatform,
  archivedBy: string,
): Promise<void> {
  await archivedDiscussionsCollection
    .doc(getArchivedDiscussionDocId(platform, discussion.discussionNumber))
    .set(serializeArchivedDiscussion(discussion, platform, archivedBy));
}

/**
 * Removes an archived discussion record for the given platform.
 *
 * @param discussionNumber The GitHub discussion number to unarchive.
 * @param platform The contribution platform that owns the archive entry.
 * @returns A promise that resolves when the archive record has been deleted.
 */
export async function unarchiveDiscussion(
  discussionNumber: number,
  platform: ContributionPlatform,
): Promise<void> {
  await archivedDiscussionsCollection
    .doc(getArchivedDiscussionDocId(platform, discussionNumber))
    .delete();
}

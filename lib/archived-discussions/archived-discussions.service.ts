import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Discussion } from "@/lib/domain/discussions.types";
import {
  archiveDiscussion as archiveDiscussionRecord,
  getArchivedDiscussions as getArchivedDiscussionRecords,
  unarchiveDiscussion as unarchiveDiscussionRecord,
} from "@/db/archived-discussions/archived-discussions.db";

export type ArchiveDiscussionInput = {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  createdAt: string;
};

/**
 * Retrieves archived discussions for a contribution platform.
 *
 * @param platform The contribution platform to filter by.
 * @returns The archived discussion records stored for the platform.
 */
export async function getArchivedDiscussions(
  platform: ContributionPlatform,
): Promise<
  Array<Discussion & { platform: ContributionPlatform; schemaVersion: number }>
> {
  return getArchivedDiscussionRecords(platform);
}

/**
 * Archives a discussion for the given platform.
 *
 * @param discussion The validated archived discussion input.
 * @param platform The contribution platform that owns the archive entry.
 * @param archivedBy The GitHub username of the archiving user.
 * @returns A promise that resolves when the archive record has been written.
 */
export async function archiveDiscussion(
  discussion: ArchiveDiscussionInput,
  platform: ContributionPlatform,
  archivedBy: string,
): Promise<void> {
  await archiveDiscussionRecord(discussion, platform, archivedBy);
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
  await unarchiveDiscussionRecord(discussionNumber, platform);
}

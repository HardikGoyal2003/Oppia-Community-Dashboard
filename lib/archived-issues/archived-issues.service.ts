import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/lib/domain/issues.types";
import {
  archiveIssue as archiveIssueRecord,
  getArchivedIssues as getArchivedIssueRecords,
  unarchiveIssue as unarchiveIssueRecord,
} from "@/db/archived-issues/archived-issues.db";

export type ArchiveIssueInput = {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  lastCommentCreatedAt: string;
  linkedProject: string;
};

/**
 * Retrieves archived issues for a contribution platform.
 *
 * @param platform The contribution platform to filter by.
 * @returns The archived issue records stored for the platform.
 */
export async function getArchivedIssues(
  platform: ContributionPlatform,
): Promise<
  Array<Issue & { platform: ContributionPlatform; schemaVersion: number }>
> {
  return getArchivedIssueRecords(platform);
}

/**
 * Archives an issue for the given platform.
 *
 * @param issue The validated archived issue input.
 * @param platform The contribution platform that owns the archive entry.
 * @param archivedBy The GitHub username of the archiving user.
 * @returns A promise that resolves when the archive record has been written.
 */
export async function archiveIssue(
  issue: ArchiveIssueInput,
  platform: ContributionPlatform,
  archivedBy: string,
): Promise<void> {
  await archiveIssueRecord(issue, platform, archivedBy);
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
  await unarchiveIssueRecord(issueNumber, platform);
}

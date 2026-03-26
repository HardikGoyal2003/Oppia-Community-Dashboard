import { GitHubIssue } from "@/lib/github/github.types";
import type { Issue } from "@/lib/domain/issues.types";
import { getIssueBucket } from "@/lib/domain/issue-buckets";
import { CategorizedProjectIssues } from "../../../dashboard.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { unarchiveIssueForPlatform } from "./archived-issues-api.service";

export async function categorizeIssues(
  rawIssues: GitHubIssue[],
  archivedIssues: Issue[],
  platform: ContributionPlatform,
): Promise<CategorizedProjectIssues> {
  const liveIssueNumbers = new Set(rawIssues.map((issue) => issue.issueNumber));

  const activeArchivedIssues = archivedIssues.filter((issue) =>
    liveIssueNumbers.has(issue.issueNumber),
  );

  const staleArchivedIssues = archivedIssues.filter(
    (issue) => !liveIssueNumbers.has(issue.issueNumber),
  );

  await Promise.all(
    staleArchivedIssues.map((issue) =>
      unarchiveIssueForPlatform(issue.issueNumber, platform),
    ),
  );

  const result: CategorizedProjectIssues = {
    team1: [],
    team2: [],
    team3: [],
    others: [],
    archive: [...activeArchivedIssues],
  };

  for (const rawIssue of rawIssues) {
    const archiveIndex = result.archive.findIndex(
      (i) => i.issueNumber === rawIssue.issueNumber,
    );

    const isUpdated =
      archiveIndex !== -1 &&
      new Date(rawIssue.lastCommentCreatedAt) >
        new Date(result.archive[archiveIndex].lastCommentCreatedAt);

    if (isUpdated) {
      result.archive.splice(archiveIndex, 1);
      await unarchiveIssueForPlatform(rawIssue.issueNumber, platform);
    }

    if (archiveIndex === -1 || isUpdated) {
      const issue = { ...rawIssue, isArchived: false };
      result[getIssueBucket(platform, rawIssue.linkedProject)].push(issue);
    }
  }

  return result;
}

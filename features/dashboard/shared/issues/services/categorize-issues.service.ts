import { RawIssue } from "@/lib/github/github.types";
import { CategorizedProjectIssues, Issue } from "../../../dashboard.types";
import { unarchiveIssue } from "@/db/archived-issues.db";
import { CONSTANTS } from "@/lib/constants";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

export async function categorizeIssues(
  rawIssues: RawIssue[],
  archivedIssues: Issue[],
  platform: ContributionPlatform
): Promise<CategorizedProjectIssues> {
  const liveIssueNumbers = new Set(
    rawIssues.map(issue => issue.issueNumber)
  );

  const activeArchivedIssues = archivedIssues.filter(issue =>
    liveIssueNumbers.has(issue.issueNumber)
  );

  const staleArchivedIssues = archivedIssues.filter(
    issue => !liveIssueNumbers.has(issue.issueNumber)
  );

  await Promise.all(
    staleArchivedIssues.map(issue =>
      unarchiveIssue(issue.issueNumber, platform)
    )
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
      i => i.issueNumber === rawIssue.issueNumber
    );

    const isUpdated =
      archiveIndex !== -1 &&
      new Date(rawIssue.lastCommentCreatedAt) >
      new Date(result.archive[archiveIndex].lastCommentCreatedAt);

    if (isUpdated) {
      result.archive.splice(archiveIndex, 1);
      await unarchiveIssue(rawIssue.issueNumber, platform);
    }

    if (archiveIndex === -1 || isUpdated) {
      const issue = { ...rawIssue, isArchived: false };

      if (platform === "ANDROID") {
        switch (rawIssue.linkedProject) {
          case CONSTANTS.ANDROID_TEAMS.CLAM:
            result.team1.push(issue);
            break;
          case CONSTANTS.ANDROID_TEAMS.DEV_WORKFLOW_INFRA:
            result.team2.push(issue);
            break;
          default:
            result.others.push(issue);
        }
      } else {
        switch (rawIssue.linkedProject) {
          case CONSTANTS.WEB_TEAMS.LEAP:
            result.team1.push(issue);
            break;
          case CONSTANTS.WEB_TEAMS.CORE:
            result.team2.push(issue);
            break;
          case CONSTANTS.WEB_TEAMS.DEV_WORKFLOW:
            result.team3.push(issue);
            break;
          default:
            result.others.push(issue);
        }
      }
    }
  }

  return result;
}

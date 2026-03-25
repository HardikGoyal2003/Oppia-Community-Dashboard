import { RawIssue } from "@/lib/github/github.types";
import type { Issue } from "@/lib/domain/issues.types";
import { CategorizedProjectIssues } from "../../../dashboard.types";
import { ANDROID_TEAMS, WEB_TEAMS } from "@/lib/config/teams.constants";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { unarchiveIssueForPlatform } from "./archived-issues-api.service";

export async function categorizeIssues(
  rawIssues: RawIssue[],
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

      if (platform === "ANDROID") {
        switch (rawIssue.linkedProject) {
          case ANDROID_TEAMS.CLAM:
            result.team1.push(issue);
            break;
          case ANDROID_TEAMS.DEV_WORKFLOW_INFRA:
            result.team2.push(issue);
            break;
          default:
            result.others.push(issue);
        }
      } else {
        switch (rawIssue.linkedProject) {
          case WEB_TEAMS.LEAP:
            result.team1.push(issue);
            break;
          case WEB_TEAMS.CORE:
            result.team2.push(issue);
            break;
          case WEB_TEAMS.DEV_WORKFLOW:
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

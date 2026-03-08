import { RawIssue } from "@/lib/github/github-fetcher.types";
import { CategorizedProjectIssues, Issue } from "../dashboard.types";
import { unarchiveIssue } from "@/db/archived-issues.db";
import { CONSTANTS } from "@/lib/contants";

export async function categorizeIssues(
  rawIssues: RawIssue[],
  archivedIssues: Issue[]
): Promise<CategorizedProjectIssues> {
  const result: CategorizedProjectIssues = {
    core: [],
    leap: [],
    dev: [],
    others: [],
    archive: [...archivedIssues],
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
      await unarchiveIssue(rawIssue.issueNumber);
    }

    if (archiveIndex === -1 || isUpdated) {
      const issue = { ...rawIssue, isArchived: false };

      switch (rawIssue.linkedProject) {
        case CONSTANTS.WEB_TEAMS.CORE:
          result.core.push(issue);
          break;
        case CONSTANTS.WEB_TEAMS.LEAP:
          result.leap.push(issue);
          break;
        case CONSTANTS.WEB_TEAMS.DEV_WORKFLOW:
          result.dev.push(issue);
          break;
        default:
          result.others.push(issue);
      }
    }
  }

  return result;
}

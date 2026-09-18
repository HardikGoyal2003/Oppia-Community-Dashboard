import {
  unarchiveIssue,
  getArchivedIssues,
} from "@/db/archived-issues/archived-issues.db";
import { createDailyTeamMetric } from "@/db/team-metrics/daily-team-metrics.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { TEAM_DEFINITIONS } from "@/lib/domain/team-definitions";
import { fetchUnansweredIssues } from "@/lib/github/github-unanswered-issues.fetcher";
import type { GitHubIssue } from "@/lib/github/github.types";
import { getIstDateKey } from "@/lib/utils/date.utils";

type TeamMetricCaptureSummary = {
  capturedAt: Date;
  dateKey: string;
  totalTeams: number;
  teams: Array<{
    platform: ContributionPlatform;
    teamId: string;
    teamName: string;
    unansweredIssuesCount: number;
    maxWaitingDays: number;
  }>;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Computes the maximum number of days any issue has been waiting for a response.
 *
 * @param issues The visible unanswered issues for a team.
 * @param capturedAt The snapshot time.
 * @returns The max waiting time in days, or 0 when there are no issues.
 */
function getMaxWaitingDays(issues: GitHubIssue[], capturedAt: Date): number {
  if (issues.length === 0) {
    return 0;
  }

  const capturedAtMillis = capturedAt.getTime();

  return issues.reduce((max, issue) => {
    const waitingDays =
      Math.max(
        capturedAtMillis - new Date(issue.lastCommentCreatedAt).getTime(),
        0,
      ) / DAY_IN_MILLISECONDS;

    return Math.max(max, waitingDays);
  }, 0);
}

/**
 * Filters live unanswered issues against archived records and identifies archive rows that should be removed.
 *
 * @param liveIssues The currently fetched unanswered issues from GitHub.
 * @param archivedIssues The archived issues stored for the same platform.
 * @returns The visible live issues plus archived records that should be unarchived.
 */
function getVisibleIssues(
  liveIssues: GitHubIssue[],
  archivedIssues: Awaited<ReturnType<typeof getArchivedIssues>>,
): {
  staleArchivedIssueNumbers: number[];
  updatedArchivedIssueNumbers: number[];
  visibleIssues: GitHubIssue[];
} {
  const liveIssuesByNumber = new Map(
    liveIssues.map((issue) => [issue.issueNumber, issue]),
  );

  const staleArchivedIssueNumbers = archivedIssues
    .filter((issue) => !liveIssuesByNumber.has(issue.issueNumber))
    .map((issue) => issue.issueNumber);

  const activeArchivedIssues = archivedIssues.filter((issue) =>
    liveIssuesByNumber.has(issue.issueNumber),
  );

  const updatedArchivedIssueNumbers = activeArchivedIssues
    .filter((issue) => {
      const liveIssue = liveIssuesByNumber.get(issue.issueNumber);

      return (
        liveIssue !== undefined &&
        new Date(liveIssue.lastCommentCreatedAt) >
          new Date(issue.lastCommentCreatedAt)
      );
    })
    .map((issue) => issue.issueNumber);

  const hiddenArchivedIssueNumbers = new Set(
    activeArchivedIssues
      .filter(
        (issue) => !updatedArchivedIssueNumbers.includes(issue.issueNumber),
      )
      .map((issue) => issue.issueNumber),
  );

  return {
    staleArchivedIssueNumbers,
    updatedArchivedIssueNumbers,
    visibleIssues: liveIssues.filter(
      (issue) => !hiddenArchivedIssueNumbers.has(issue.issueNumber),
    ),
  };
}

/**
 * Captures one day's unanswered-issue metric for every configured team on a single platform.
 *
 * @param platform The platform to capture.
 * @param capturedAt The capture timestamp.
 * @param dateKey The IST-normalized date key.
 * @returns The captured team summaries for the platform.
 */
async function capturePlatformTeamMetrics(
  platform: ContributionPlatform,
  capturedAt: Date,
  dateKey: string,
): Promise<TeamMetricCaptureSummary["teams"]> {
  const [liveIssues, archivedIssues] = await Promise.all([
    fetchUnansweredIssues(GITHUB_REPOS[platform], platform),
    getArchivedIssues(platform),
  ]);

  const {
    staleArchivedIssueNumbers,
    updatedArchivedIssueNumbers,
    visibleIssues,
  } = getVisibleIssues(liveIssues, archivedIssues);

  await Promise.all(
    [...staleArchivedIssueNumbers, ...updatedArchivedIssueNumbers].map(
      (issueNumber) => unarchiveIssue(issueNumber, platform),
    ),
  );

  const platformTeams = TEAM_DEFINITIONS.filter(
    (team) => team.platform === platform,
  );

  const summaries = platformTeams.map((team) => {
    const teamIssues = visibleIssues.filter(
      (issue) => issue.linkedProject === team.linkedProject,
    );

    return {
      platform,
      teamId: team.teamId,
      teamName: team.teamName,
      unansweredIssuesCount: teamIssues.length,
      maxWaitingDays: getMaxWaitingDays(teamIssues, capturedAt),
    };
  });

  await Promise.all(
    summaries.map((summary) =>
      createDailyTeamMetric({
        capturedAt,
        dateKey,
        maxWaitingDays: summary.maxWaitingDays,
        platform: summary.platform,
        teamId: summary.teamId,
        teamName: summary.teamName,
        unansweredIssuesCount: summary.unansweredIssuesCount,
      }),
    ),
  );

  return summaries;
}

/**
 * Captures daily unanswered-issue snapshot for every configured team.
 *
 * @returns A summary of the persisted daily team metrics.
 */
export async function captureDailyUnansweredIssueMetrics(): Promise<TeamMetricCaptureSummary> {
  const capturedAt = new Date();
  const dateKey = getIstDateKey(capturedAt);

  const [webTeams, androidTeams] = await Promise.all([
    capturePlatformTeamMetrics("WEB", capturedAt, dateKey),
    capturePlatformTeamMetrics("ANDROID", capturedAt, dateKey),
  ]);

  const teams = [...webTeams, ...androidTeams];

  return {
    capturedAt,
    dateKey,
    totalTeams: teams.length,
    teams,
  };
}

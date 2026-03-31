import {
  unarchiveIssue,
  getArchivedIssues,
} from "@/db/archived-issues/archived-issues.db";
import { upsertDailyTeamMetric } from "@/db/team-metrics/daily-team-metrics.db";
import { ANDROID_TEAMS, GITHUB_REPOS, WEB_TEAMS } from "@/lib/config";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { fetchUnansweredIssues } from "@/lib/github/github.fetcher";
import type { GitHubIssue } from "@/lib/github/github.types";

type TeamDefinition = {
  linkedProject: string;
  platform: ContributionPlatform;
  teamId: string;
  teamName: string;
};

type TeamMetricCaptureSummary = {
  capturedAt: Date;
  dateKey: string;
  totalTeams: number;
  teams: Array<{
    platform: ContributionPlatform;
    teamId: string;
    teamName: string;
    unansweredIssuesCount: number;
  }>;
};

const TEAM_DEFINITIONS: TeamDefinition[] = [
  {
    linkedProject: WEB_TEAMS.LEAP,
    platform: "WEB",
    teamId: "WEB_LEAP",
    teamName: WEB_TEAMS.LEAP,
  },
  {
    linkedProject: WEB_TEAMS.CORE,
    platform: "WEB",
    teamId: "WEB_CORE",
    teamName: WEB_TEAMS.CORE,
  },
  {
    linkedProject: WEB_TEAMS.DEV_WORKFLOW,
    platform: "WEB",
    teamId: "WEB_DEV_WORKFLOW",
    teamName: WEB_TEAMS.DEV_WORKFLOW,
  },
  {
    linkedProject: ANDROID_TEAMS.CLAM,
    platform: "ANDROID",
    teamId: "ANDROID_CLAM",
    teamName: ANDROID_TEAMS.CLAM,
  },
  {
    linkedProject: ANDROID_TEAMS.DEV_WORKFLOW_INFRA,
    platform: "ANDROID",
    teamId: "ANDROID_DEV_WORKFLOW_INFRA",
    teamName: ANDROID_TEAMS.DEV_WORKFLOW_INFRA,
  },
];

/**
 * Builds the YYYY-MM-DD date key using the Asia/Kolkata timezone.
 *
 * @param date The capture timestamp to format.
 * @returns The IST-normalized date key.
 */
function getDateKeyForIst(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  });

  return formatter.format(date);
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
    fetchUnansweredIssues(GITHUB_REPOS[platform]),
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
    const unansweredIssuesCount = visibleIssues.filter(
      (issue) => issue.linkedProject === team.linkedProject,
    ).length;

    return {
      platform,
      teamId: team.teamId,
      teamName: team.teamName,
      unansweredIssuesCount,
    };
  });

  await Promise.all(
    summaries.map((summary) =>
      upsertDailyTeamMetric({
        capturedAt,
        dateKey,
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
 * Captures one daily unanswered-issue snapshot for every configured team.
 *
 * @returns A summary of the persisted daily team metrics.
 */
export async function captureDailyUnansweredIssueMetrics(): Promise<TeamMetricCaptureSummary> {
  const capturedAt = new Date();
  const dateKey = getDateKeyForIst(capturedAt);

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

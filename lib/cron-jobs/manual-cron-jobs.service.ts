import type {
  CronJobDefinition,
  CronJobRunResult,
} from "@/lib/domain/cron-jobs.types";
import { LibInvalidStateError } from "@/lib/lib.errors";
import { captureDailyUnansweredIssueMetrics } from "@/lib/team-metrics/capture-daily-team-metrics.service";
import { syncTeamGfiCounts } from "@/lib/teams/sync-team-gfi-counts.service";
import { syncOrgMeta } from "@/lib/org-meta/sync-org-meta.service";
import { syncReviewerTeams } from "@/lib/team-activity/sync-reviewer-teams.service";
import { syncReviewCycles } from "@/lib/team-activity/sync-review-cycles.service";
import { syncPendingReviews } from "@/lib/team-activity/sync-pending-reviews.service";

const CRON_JOBS: CronJobDefinition[] = [
  {
    key: "capture_daily_team_metrics",
    name: "Capture Daily Team Metrics",
    description:
      "Fetch unanswered issue counts for all configured teams and store a snapshot in dailyTeamMetrics.",
  },
  {
    key: "sync_team_gfi_counts",
    name: "Sync Team GFI Counts",
    description:
      "Fetch open unassigned good first issues from GitHub and update each team's gfiCounts.",
  },
  {
    key: "sync_org_meta",
    name: "Sync Org Meta",
    description:
      "Fetch org members and repo collaborators from GitHub and cache them in Firestore for faster unanswered-issues lookups.",
  },
  {
    key: "sync_reviewer_teams",
    name: "Sync Reviewer Teams",
    description:
      "Fetch web sub-teams and their members from GitHub under all-web-dev-teams and store in teamReviewers collection.",
  },
  {
    key: "sync_review_cycles",
    name: "Sync Review Cycles",
    description:
      "Fetch open PRs, extract completed review cycles from timeline events, and update completedReviews and avgReviewTimeHours on reviewer docs. Runs daily.",
  },
  {
    key: "sync_pending_reviews",
    name: "Sync Pending Reviews",
    description:
      "Fetch open PR assignments and update pendingReviews on reviewer docs. Runs daily.",
  },
];

/**
 * Lists cron jobs that can be manually triggered in development mode.
 *
 * @returns The supported cron jobs.
 */
export function listAvailableCronJobs(): CronJobDefinition[] {
  return CRON_JOBS;
}

/**
 * Runs a supported cron job and returns a human-readable summary.
 *
 * @param jobKey The cron job key to execute.
 * @returns The executed job result.
 */
export async function runCronJob(jobKey: string): Promise<CronJobRunResult> {
  const job = CRON_JOBS.find((item) => item.key === jobKey);

  if (!job) {
    throw new LibInvalidStateError("CronJob", `Unknown cron job: ${jobKey}`);
  }

  const startedAt = new Date();

  switch (job.key) {
    case "capture_daily_team_metrics": {
      const result = await captureDailyUnansweredIssueMetrics();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Captured at: ${finishedAt.toLocaleString("en-IN")}.`,
          `Date key: ${result.dateKey}.`,
          `Total teams: ${result.totalTeams}.`,
          ...result.teams.map(
            (team) =>
              `${team.platform} / ${team.teamName}: ${team.unansweredIssuesCount} unanswered issues.`,
          ),
        ].join("\n"),
      };
    }
    case "sync_team_gfi_counts": {
      const result = await syncTeamGfiCounts();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Captured at: ${finishedAt.toLocaleString("en-IN")}.`,
          `Updated teams: ${result.updatedTeamsCount}.`,
          `Total GFI issues scanned: ${result.totalIssuesCount}.`,
          `Skipped issues: ${result.skippedIssuesCount}.`,
        ].join("\n"),
      };
    }
    case "sync_org_meta": {
      const result = await syncOrgMeta();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Platforms: ${result.platforms.join(", ")}.`,
          `Org members: ${result.orgMemberCount}.`,
          `Collaborators: ${result.collaboratorCount}.`,
          `Last updated: ${result.lastUpdated}.`,
        ].join("\n"),
      };
    }
    case "sync_reviewer_teams": {
      const result = await syncReviewerTeams();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Platform: ${result.platform}.`,
          `Synced ${result.syncedTeamsCount} teams with ${result.totalMembersCount} members.`,
          `Initial docs created: ${result.initialDocsCreated}.`,
          `Last synced: ${finishedAt.toLocaleString("en-IN")}.`,
        ].join("\n"),
      };
    }
    case "sync_review_cycles": {
      const result = await syncReviewCycles();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Completed cycles: ${result.completedCyclesCount}.`,
          `New cycles: ${result.newCyclesCount}.`,
          `Updated reviewers: ${result.updatedReviewersCount}.`,
          `Finished at: ${finishedAt.toLocaleString("en-IN")}.`,
        ].join("\n"),
      };
    }
    case "sync_pending_reviews": {
      const result = await syncPendingReviews();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Pending reviews synced: ${result.pendingReviewsCount}.`,
          `Updated reviewers: ${result.updatedReviewersCount}.`,
          `Finished at: ${finishedAt.toLocaleString("en-IN")}.`,
        ].join("\n"),
      };
    }
    default:
      throw new LibInvalidStateError(
        "CronJob",
        `No cron runner registered for job: ${jobKey}`,
      );
  }
}

import type {
  CronJobDefinition,
  CronJobRunResult,
} from "@/lib/domain/cron-jobs.types";
import { LibInvalidStateError } from "@/lib/lib.errors";
import { captureDailyUnansweredIssueMetrics } from "@/lib/team-metrics/capture-daily-team-metrics.service";
import { syncTeamGfiCounts } from "@/lib/teams/sync-team-gfi-counts.service";

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
    default:
      throw new LibInvalidStateError(
        "CronJob",
        `No cron runner registered for job: ${jobKey}`,
      );
  }
}

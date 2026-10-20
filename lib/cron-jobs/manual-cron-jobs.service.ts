import type {
  CronJobDefinition,
  CronJobRunResult,
} from "@/lib/domain/cron-jobs.types";
import { LibInvalidStateError } from "@/lib/lib.errors";
import { captureDailyUnansweredIssueMetrics } from "@/lib/team-metrics/capture-daily-team-metrics.service";
import { syncTeamGfiCounts } from "@/lib/teams/sync-team-gfi-counts.service";
import { syncOrgMeta } from "@/lib/org-meta/sync-org-meta.service";
import { syncActionItems } from "@/lib/action-items/action-items.service";
import { escalateDueActionItems } from "@/lib/action-items/escalation.service";
import { sendWeeklyActionItemDigest } from "@/lib/notifications/action-item-digest.service";

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
    key: "sync_action_items",
    name: "Sync Action Items",
    description:
      "Derive action items from the current team reports and persist them (creates, refreshes, reopens).",
  },
  {
    key: "send_action_item_digest",
    name: "Send Action Items Digest",
    description:
      "Sync action items and email the weekly digest of open items to each team's leads (respects weekly idempotency).",
  },
  {
    key: "escalate_action_items",
    name: "Escalate Action Items",
    description:
      "Sync action items and nudge leads about items that have been open without action past the escalation interval (idempotent per day).",
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
    case "sync_action_items": {
      const result = await syncActionItems();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Synced at: ${finishedAt.toLocaleString("en-IN")}.`,
          `Detected action items: ${result.detectedCount}.`,
          `Created: ${result.createdCount}, refreshed: ${result.updatedCount}, reopened: ${result.reopenedCount}, auto-resolved: ${result.resolvedCount}.`,
          `Active (open): ${result.activeCount}.`,
        ].join("\n"),
      };
    }
    case "send_action_item_digest": {
      const result = await sendWeeklyActionItemDigest();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Digest period (week starting): ${result.periodKey}.`,
          `Digest enabled: ${result.enabled ? "yes" : "no"}.`,
          `Teams with active items: ${result.teamsConsidered}.`,
          `Teams notified: ${result.teamsNotified}.`,
          ...result.teams.map(
            (team) =>
              `${team.teamName}: ${team.itemCount} item(s), ${team.recipientCount} recipient(s) — ${team.channelOutcomes
                .map((outcome) => `${outcome.channel}: ${outcome.status}`)
                .join(", ")}.`,
          ),
          ...(result.skippedTeamKeys.length > 0
            ? [
                `Skipped (no active items or no leads): ${result.skippedTeamKeys.join(", ")}.`,
              ]
            : []),
        ].join("\n"),
      };
    }
    case "escalate_action_items": {
      const result = await escalateDueActionItems();
      const finishedAt = new Date();

      return {
        finishedAt,
        jobKey: job.key,
        jobName: job.name,
        startedAt,
        summary: [
          "Cron job completed.",
          `Escalation period (IST date): ${result.periodKey}.`,
          `Escalation enabled: ${result.enabled ? "yes" : "no"}.`,
          `Escalation interval: ${result.escalationAfterDays} day(s).`,
          `Items due for escalation: ${result.itemsDueCount}.`,
          `Teams notified: ${result.teamsNotified}.`,
          ...result.teams.map(
            (team) =>
              `${team.teamName}: ${team.itemCount} item(s) escalated to level ${team.newEscalationLevel}, ${team.recipientCount} recipient(s) — ${team.channelOutcomes
                .map((outcome) => `${outcome.channel}: ${outcome.status}`)
                .join(", ")}.`,
          ),
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

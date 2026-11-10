import { DbNotFoundError } from "@/db/db.errors";
import {
  createDataJobRun,
  getDataJobRunById,
  listDataJobRuns,
  markDataJobRunFailed,
  markDataJobRunSucceeded,
} from "@/db/data-jobs/data-job-runs.db";
import { backfillSchemaVersions } from "@/db/schema/schema-migration-runner";
import {
  clearReviewCycleBackfillState,
  getReviewCycleBackfillState,
  saveReviewCycleBackfillState,
} from "@/db/review-cycle-backfill/review-cycle-backfill.db";
import { upsertReviewCycles } from "@/db/review-cycles/review-cycles.db";
import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { getAllUsers, updateUserRoles } from "@/db/users/users.db";
import { LibInvalidStateError } from "@/lib/lib.errors";
import { runReviewCycleBackfillStep } from "@/lib/team-activity/backfill-review-cycles.service";
import { refreshReviewerStats } from "@/lib/team-activity/sync-review-cycles.service";
import type { ReviewCycleBackfillState } from "@/lib/domain/review-cycle-backfill.types";
import type {
  DataJobDefinition,
  DataJobResult,
  DataJobRun,
} from "@/lib/domain/data-jobs.types";

type DataJobActor = {
  userId: string;
  githubUsername: string;
};

type DataJobHandlerContext = {
  dryRun: boolean;
  triggeredByGithubUsername: string;
};

type DataJobHandler = (
  context: DataJobHandlerContext,
) => Promise<DataJobResult>;

type RegisteredDataJob = DataJobDefinition & {
  handler: DataJobHandler;
};

/** Window used by the one-off review-cycle backfill job. */
const REVIEW_CYCLE_BACKFILL_MONTHS = 2;

/**
 * Size of each backfill window. A window is only a checkpoint boundary: PRs
 * inside it are tracked individually, so a larger window does not make a
 * single run heavier.
 */
const REVIEW_CYCLE_BACKFILL_WINDOW_DAYS = 7;

/**
 * Wall-clock budget for the backfill loop. The platform terminated previous
 * runs at roughly 275s, so we stop well before that, persist progress, and
 * leave room to refresh reviewer stats before the invocation ends.
 */
const REVIEW_CYCLE_BACKFILL_TIME_BUDGET_MS = 120_000;

/**
 * Formats a Date as a UTC `YYYY-MM-DD` key, matching GitHub search filters.
 *
 * @param date The date to format.
 * @returns The date key.
 */
function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Adds days to a `YYYY-MM-DD` date key.
 *
 * @param dateKey The starting date key.
 * @param days The number of days to add.
 * @returns The shifted date key.
 */
function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toUtcDateKey(date);
}

/**
 * Returns the earlier of two `YYYY-MM-DD` date keys.
 *
 * @param a The first date key.
 * @param b The second date key.
 * @returns The earlier date key.
 */
function minDateKey(a: string, b: string): string {
  return a < b ? a : b;
}

/**
 * Returns the later of two `YYYY-MM-DD` date keys.
 *
 * @param a The first date key.
 * @param b The second date key.
 * @returns The later date key.
 */
function maxDateKey(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * Audits users and reports accounts that do not yet have a selected platform.
 *
 * @param context The data-job execution context.
 * @returns A summary of the audit findings.
 */
async function auditUsersMissingPlatform(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  void context.dryRun;
  const users = await getAllUsers();
  const missingPlatformUsers = users.filter((user) => user.platform === null);

  return {
    summary:
      missingPlatformUsers.length === 0
        ? "Audit completed. All users have a platform."
        : `Audit completed. ${missingPlatformUsers.length} users are missing a platform: ${missingPlatformUsers
            .slice(0, 10)
            .map((user) => user.githubUsername)
            .join(", ")}.`,
  };
}

/**
 * Audits non-contributor users and reports accounts that are missing a team assignment.
 *
 * @param context The data-job execution context.
 * @returns A summary of the audit findings.
 */
async function auditPrivilegedUsersMissingTeam(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  void context.dryRun;
  const users = await getAllUsers();
  const flaggedUsers = users.filter(
    (user) => user.role !== "CONTRIBUTOR" && user.team === null,
  );

  return {
    summary:
      flaggedUsers.length === 0
        ? "Audit completed. All non-contributor users have a team."
        : `Audit completed. ${flaggedUsers.length} non-contributor users are missing a team: ${flaggedUsers
            .slice(0, 10)
            .map((user) => user.githubUsername)
            .join(", ")}.`,
  };
}

/**
 * Moves users who have a team assignment but still hold the CONTRIBUTOR role
 * to ALUMNI. These are likely former members whose role was never updated.
 *
 * @param context The data-job execution context.
 * @returns A summary of the cleanup results.
 */
async function cleanupTeamContributorsToAlumni(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  const users = await getAllUsers();
  const flaggedUsers = users.filter(
    (user) => user.team !== null && user.role === "CONTRIBUTOR",
  );

  if (flaggedUsers.length === 0) {
    return {
      summary:
        "Cleanup completed. No users found with a team assignment and CONTRIBUTOR role.",
    };
  }

  if (!context.dryRun) {
    // Persist the role changes in batched writes instead of one read + write
    // round trip per user, which previously pushed large cleanups past the
    // serverless execution limit.
    await updateUserRoles(
      flaggedUsers.map((user) => ({ uid: user.id, role: "ALUMNI" })),
    );
  }

  const updatedCount = flaggedUsers.length;
  const suffix = context.dryRun ? " (dry run — no changes persisted)" : ".";

  return {
    summary: `Cleanup completed. ${updatedCount} user(s) moved from CONTRIBUTOR to ALUMNI${suffix}. Affected users: ${flaggedUsers
      .slice(0, 10)
      .map((u) => u.githubUsername)
      .join(", ")}${flaggedUsers.length > 10 ? "..." : ""}`,
  };
}

/**
 * Upgrades every stored document to the latest schema version and persists the
 * migrated document. Unversioned legacy documents are stamped with version 1.
 *
 * @param context The data-job execution context.
 * @returns A summary of the schema backfill results.
 */
async function backfillSchemaVersionsJob(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  const summary = await backfillSchemaVersions({ dryRun: context.dryRun });
  const suffix = context.dryRun ? " (dry run — no changes persisted)" : ".";
  const failureSummary =
    summary.failedCount > 0
      ? ` ${summary.failedCount} document(s) could not be migrated.`
      : "";

  return {
    summary: `Schema backfill completed. ${summary.migratedCount} of ${summary.scannedCount} document(s) upgraded${suffix}${failureSummary}`,
  };
}

/**
 * Backfills the last two months of review cycles from GitHub and recomputes
 * every reviewer's analytics from the stored cycles.
 *
 * The range is walked in small date windows, and PR-level progress inside the
 * current window is checkpointed. If the platform terminates a run, the next
 * run resumes from the saved window and PR set instead of starting over.
 * Requires reviewer teams to be synced first, since only cycles belonging to
 * known team members are persisted.
 *
 * @param context The data-job execution context.
 * @returns A summary of the backfill results.
 */
async function backfillReviewCyclesJob(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  void context.dryRun;

  const teamDoc = await getTeamReviewers("WEB");
  if (!teamDoc || teamDoc.teams.length === 0) {
    throw new LibInvalidStateError(
      "ReviewCycleBackfill",
      "No reviewer teams found. Run Sync Reviewer Teams before backfilling review cycles.",
    );
  }

  const knownLogins = new Set<string>();
  for (const team of teamDoc.teams) {
    for (const member of team.members) {
      knownLogins.add(member.username);
    }
  }

  const deadlineMs = Date.now() + REVIEW_CYCLE_BACKFILL_TIME_BUDGET_MS;
  const todayKey = toUtcDateKey(new Date());
  const defaultStart = new Date();
  defaultStart.setUTCMonth(
    defaultStart.getUTCMonth() - REVIEW_CYCLE_BACKFILL_MONTHS,
  );
  const defaultStartKey = toUtcDateKey(defaultStart);

  const savedState = await getReviewCycleBackfillState();

  let state: ReviewCycleBackfillState = savedState
    ? { ...savedState, targetEnd: maxDateKey(savedState.targetEnd, todayKey) }
    : {
        windowStart: defaultStartKey,
        windowEnd: minDateKey(
          addDaysToDateKey(
            defaultStartKey,
            REVIEW_CYCLE_BACKFILL_WINDOW_DAYS - 1,
          ),
          todayKey,
        ),
        targetEnd: todayKey,
        processedPrNumbers: [],
        updatedAt: new Date(),
      };

  let windowsCompleted = 0;
  let prsProcessed = 0;
  let cyclesWritten = 0;

  while (state.windowStart <= state.targetEnd && Date.now() < deadlineMs) {
    const step = await runReviewCycleBackfillStep({
      sinceDate: new Date(`${state.windowStart}T00:00:00.000Z`),
      untilDate: new Date(`${state.windowEnd}T23:59:59.999Z`),
      processedPrNumbers: new Set(state.processedPrNumbers),
      knownLogins,
      deadlineMs,
    });

    if (step.records.length > 0) {
      await upsertReviewCycles(step.records);
      cyclesWritten += step.records.length;
    }
    prsProcessed += step.processedPrNumbers.length;

    if (step.complete) {
      windowsCompleted++;
      const nextStart = addDaysToDateKey(state.windowEnd, 1);
      state = {
        windowStart: nextStart,
        windowEnd: minDateKey(
          addDaysToDateKey(nextStart, REVIEW_CYCLE_BACKFILL_WINDOW_DAYS - 1),
          state.targetEnd,
        ),
        targetEnd: state.targetEnd,
        processedPrNumbers: [],
        updatedAt: new Date(),
      };
    } else {
      state = {
        ...state,
        processedPrNumbers: Array.from(
          new Set([...state.processedPrNumbers, ...step.processedPrNumbers]),
        ),
        updatedAt: new Date(),
      };
    }

    await saveReviewCycleBackfillState(state);

    if (!step.complete) break;
  }

  const completed = state.windowStart > state.targetEnd;

  const updatedReviewersCount = await refreshReviewerStats();

  if (completed) {
    await clearReviewCycleBackfillState();
  }

  const progressSummary = completed
    ? "Backfill complete."
    : `Partial progress — run the job again to continue window ${state.windowStart} to ${state.windowEnd}${
        state.processedPrNumbers.length > 0
          ? ` (${state.processedPrNumbers.length} PR(s) already done in this window)`
          : ""
      }.`;

  return {
    summary: `Review cycle backfill processed ${windowsCompleted} window(s), ${prsProcessed} PR(s), ${cyclesWritten} cycle(s). ${updatedReviewersCount} reviewer(s) refreshed. ${progressSummary}`,
  };
}

const DATA_JOB_REGISTRY: RegisteredDataJob[] = [
  {
    key: "cleanup_team_contributors_to_alumni",
    name: "Move Team Contributors to Alumni",
    description:
      "Finds users with a team assignment but CONTRIBUTOR role and updates their role to ALUMNI.",
    kind: "CLEANUP",
    supportsDryRun: true,
    handler: cleanupTeamContributorsToAlumni,
  },
  {
    key: "audit_users_missing_platform",
    name: "Audit Users Missing Platform",
    description:
      "Scans users and reports accounts that still do not have a selected platform.",
    kind: "AUDIT",
    supportsDryRun: true,
    handler: auditUsersMissingPlatform,
  },
  {
    key: "audit_privileged_users_missing_team",
    name: "Audit Privileged Users Missing Team",
    description:
      "Scans non-contributor users and reports accounts that are missing a team assignment.",
    kind: "AUDIT",
    supportsDryRun: true,
    handler: auditPrivilegedUsersMissingTeam,
  },
  {
    key: "backfill_schema_versions",
    name: "Backfill Schema Versions",
    description:
      "Upgrades stored documents to the latest schema version and persists the migrated shape.",
    kind: "MIGRATION",
    supportsDryRun: true,
    handler: backfillSchemaVersionsJob,
  },
  {
    key: "backfill_review_cycles",
    name: "Backfill Review Cycles (2 months)",
    description:
      "Re-fetches the last 2 months of review cycles from GitHub and recomputes reviewer analytics. Resumable: if it stops early, run it again to continue. Run Sync Reviewer Teams first so team membership is current.",
    kind: "BACKFILL",
    supportsDryRun: false,
    handler: backfillReviewCyclesJob,
  },
];

/**
 * Lists the available data jobs exposed in the control panel.
 *
 * @returns The registered data jobs without their handlers.
 */
export function listAvailableDataJobs(): DataJobDefinition[] {
  return DATA_JOB_REGISTRY.map((job) => {
    return {
      key: job.key,
      name: job.name,
      description: job.description,
      kind: job.kind,
      supportsDryRun: job.supportsDryRun,
    };
  });
}

/**
 * Lists recent data-job runs for the control panel.
 *
 * @returns The recent persisted data-job runs.
 */
export async function listRecentDataJobRuns(): Promise<DataJobRun[]> {
  return listDataJobRuns();
}

/**
 * Executes a registered data job and persists its run history.
 *
 * @param jobKey The registered data job key.
 * @param actor The user who triggered the job.
 * @param dryRun Whether the job should run in dry-run mode.
 * @returns The persisted data-job run after completion.
 */
export async function runDataJob(
  jobKey: string,
  actor: DataJobActor,
  dryRun: boolean,
): Promise<DataJobRun> {
  const job = DATA_JOB_REGISTRY.find((candidate) => candidate.key === jobKey);

  if (!job) {
    throw new DbNotFoundError("Data job", `Data job ${jobKey} not found.`);
  }

  const runId = await createDataJobRun({
    jobKey: job.key,
    jobName: job.name,
    kind: job.kind,
    status: "RUNNING",
    dryRun,
    triggeredByUserId: actor.userId,
    triggeredByGithubUsername: actor.githubUsername,
    summary: "Job started.",
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: null,
  });

  try {
    const result = await job.handler({
      dryRun,
      triggeredByGithubUsername: actor.githubUsername,
    });
    await markDataJobRunSucceeded(runId, result.summary);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Data job failed.";
    await markDataJobRunFailed(runId, errorMessage);
    throw error;
  }

  return getDataJobRunById(runId);
}

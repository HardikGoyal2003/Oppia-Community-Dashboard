import { DbNotFoundError } from "@/db/db.errors";
import { fetchGitHubRateLimit } from "@/lib/github/github.rate-limit";
import {
  createDataJobRun,
  getDataJobRunById,
  listDataJobRuns,
  markDataJobRunFailed,
  markDataJobRunSucceeded,
} from "@/db/data-jobs/data-job-runs.db";
import {
  clearReviewCycleBackfillState,
  getReviewCycleBackfillState,
  saveReviewCycleBackfillState,
} from "@/db/review-cycle-backfill/review-cycle-backfill.db";
import { createNewReviewCycles } from "@/db/review-cycles/review-cycles.db";
import {
  applyReviewCycleContributions,
  refreshReviewCycleAnalytics,
} from "@/lib/team-activity/review-cycle-analytics.service";
import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { LibInvalidStateError } from "@/lib/lib.errors";
import { runReviewCycleBackfillStep } from "@/lib/team-activity/backfill-review-cycles.service";
import { REVIEWER_REPORT_PLATFORM } from "@/lib/team-activity/reviewer-platform.constants";
import { getReviewerTeamLogins } from "@/lib/team-activity/reviewer-team-logins.service";
import { refreshReviewerStats } from "@/lib/team-activity/sync-review-cycles.service";
import type { ReviewCycleBackfillState } from "@/lib/domain/review-cycle-backfill.types";
import type { ReviewCycleRecord } from "@/lib/domain/reviewer-teams.types";
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

/** Fixed start date for the one-off review-cycle backfill job. */
const REVIEW_CYCLE_BACKFILL_START_DATE_KEY = "2026-01-01";

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
 * Backfills review cycles from 2026-01-01 through today and merges them into
 * reviewer analytics.
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

  const platform = REVIEWER_REPORT_PLATFORM;
  const teamDoc = await getTeamReviewers(platform);
  if (!teamDoc || teamDoc.teams.length === 0) {
    throw new LibInvalidStateError(
      "ReviewCycleBackfill",
      "No reviewer teams found. Run Sync Reviewer Teams before backfilling review cycles.",
    );
  }

  const knownLogins = await getReviewerTeamLogins();

  const deadlineMs = Date.now() + REVIEW_CYCLE_BACKFILL_TIME_BUDGET_MS;
  const todayKey = toUtcDateKey(new Date());
  const defaultStartKey = REVIEW_CYCLE_BACKFILL_START_DATE_KEY;

  const savedState = await getReviewCycleBackfillState(platform);
  const targetEndKey = savedState
    ? maxDateKey(savedState.targetEnd, todayKey)
    : todayKey;
  // Resume from the saved window. The fixed start date is only used for the
  // first run; resetting it on every resume would re-scan completed windows
  // and discard the PR-level checkpoint for the in-flight window.
  const windowStartKey = savedState ? savedState.windowStart : defaultStartKey;
  const windowEndKey = savedState
    ? minDateKey(savedState.windowEnd, targetEndKey)
    : minDateKey(
        addDaysToDateKey(
          defaultStartKey,
          REVIEW_CYCLE_BACKFILL_WINDOW_DAYS - 1,
        ),
        targetEndKey,
      );

  let state: Omit<ReviewCycleBackfillState, "schemaVersion"> = savedState
    ? {
        ...savedState,
        platform,
        windowStart: windowStartKey,
        windowEnd: windowEndKey,
        targetEnd: targetEndKey,
        updatedAt: new Date(),
      }
    : {
        platform,
        windowStart: windowStartKey,
        windowEnd: windowEndKey,
        targetEnd: targetEndKey,
        processedPrNumbers: [],
        updatedAt: new Date(),
      };

  let windowsCompleted = 0;
  let prsProcessed = 0;
  let cyclesWritten = 0;
  const affectedLogins = new Set<string>();
  const newCycleRecords: Array<Omit<ReviewCycleRecord, "schemaVersion">> = [];

  while (state.windowStart <= state.targetEnd && Date.now() < deadlineMs) {
    const step = await runReviewCycleBackfillStep({
      sinceDate: new Date(`${state.windowStart}T00:00:00.000Z`),
      untilDate: new Date(`${state.windowEnd}T23:59:59.999Z`),
      processedPrNumbers: new Set(state.processedPrNumbers),
      knownLogins,
      deadlineMs,
    });

    if (step.records.length > 0) {
      // Claim only cycles that are not already stored, so concurrent runs do
      // not double-count and only claimed records have contributions applied.
      const createdRecords = await createNewReviewCycles(
        platform,
        step.records.map((record) => ({ ...record, platform })),
      );
      newCycleRecords.push(...createdRecords);
      cyclesWritten += createdRecords.length;
      for (const record of step.records) {
        affectedLogins.add(record.reviewerLogin);
      }
    }
    for (const login of step.authorLogins) {
      affectedLogins.add(login);
    }
    prsProcessed += step.processedPrNumbers.length;

    if (step.complete) {
      windowsCompleted++;
      const nextStart = addDaysToDateKey(state.windowEnd, 1);
      state = {
        platform,
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

    await saveReviewCycleBackfillState(platform, state);

    if (!step.complete) break;
  }

  const completed = state.windowStart > state.targetEnd;

  // Merge only the cycles this invocation added. A full rebuild is reserved for
  // the explicit Repair Reviewer Analytics job, so resuming this job does not
  // re-read the entire review-cycle history on every run.
  const contributions = await applyReviewCycleContributions(
    platform,
    newCycleRecords,
  );

  const updatedReviewersCount =
    affectedLogins.size === 0
      ? 0
      : await refreshReviewerStats(
          affectedLogins,
          contributions,
          false,
          platform,
        );

  if (completed) {
    await clearReviewCycleBackfillState(platform);
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit (REST):");
  console.log(rate.core ?? "unavailable");

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

/**
 * Rebuilds the reviewer analytics snapshot and every reviewer aggregate from
 * the stored review cycles.
 *
 * Normal syncs and backfills merge incrementally. This is the explicit repair
 * path for analytics left inconsistent by an invocation that stopped between
 * writing cycles and applying their contributions.
 *
 * @param context The data-job execution context.
 * @returns A summary of the repair results.
 */
async function repairReviewerAnalyticsJob(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  void context.dryRun;

  const platform = REVIEWER_REPORT_PLATFORM;
  const analytics = await refreshReviewCycleAnalytics(platform);
  const updatedReviewersCount = await refreshReviewerStats(
    undefined,
    new Map(),
    true,
    platform,
  );

  return {
    summary: `Reviewer analytics repaired. Rebuilt ${analytics.prSizeScatter.length} scatter point(s) and refreshed ${updatedReviewersCount} reviewer(s).`,
  };
}

const DATA_JOB_REGISTRY: RegisteredDataJob[] = [
  {
    key: "backfill_review_cycles",
    name: "Backfill Review Cycles (Jan 1 2026)",
    description:
      "Re-fetches review cycles from 2026-01-01 through today and merges them into reviewer analytics. Resumable: if it stops early, run it again to continue. Run Sync Reviewer Teams first so team membership is current.",
    kind: "BACKFILL",
    supportsDryRun: false,
    handler: backfillReviewCyclesJob,
  },
  {
    key: "repair_reviewer_analytics",
    name: "Repair Reviewer Analytics",
    description:
      "Rebuilds the reviewer analytics snapshot and every reviewer aggregate from stored review cycles. This is also the first-time bootstrap: dashboard requests never scan review cycles. Use it when analytics are missing, stale, or inconsistent after an interrupted backfill.",
    kind: "MIGRATION",
    supportsDryRun: false,
    handler: repairReviewerAnalyticsJob,
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

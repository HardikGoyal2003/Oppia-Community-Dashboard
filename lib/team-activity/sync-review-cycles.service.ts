import {
  fetchCycleRecords,
  fetchClosedPRCycleRecords,
  fetchAuthoredPrCounts,
} from "@/lib/github/github.fetcher";
import { getReviewers, upsertReviewers } from "@/db/reviewers/reviewers.db";
import type { ReviewerDocument } from "@/lib/domain/reviewer-teams.types";
import { getReviewerTeamLogins } from "@/lib/team-activity/reviewer-team-logins.service";
import { createNewReviewCycles } from "@/db/review-cycles/review-cycles.db";
import {
  applyReviewCycleContributions,
  getReviewCycleAggregatesForLogins,
} from "@/lib/team-activity/review-cycle-analytics.service";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { normalizeGithubUsername } from "@/lib/utils/username.utils";
import { REVIEWER_REPORT_PLATFORM } from "./reviewer-platform.constants";
import type {
  ReviewCycleAggregate,
  ReviewCycleLoginContribution,
} from "@/lib/reviewer-teams/review-cycle-calculations";
import {
  getReviewerCycleAggregates,
  upsertReviewerCycleAggregates,
} from "@/db/reviewer-cycle-aggregates/reviewer-cycle-aggregates.db";
import {
  aggregateDocumentToReviewCycleAggregate,
  applyReviewCycleContribution,
  createEmptyReviewerCycleAggregate,
  reviewCycleAggregateToDocument,
  type ReviewerCycleAggregateWrite,
} from "@/lib/team-activity/reviewer-cycle-aggregate.utils";

type SyncSummary = {
  completedCyclesCount: number;
  newCyclesCount: number;
  updatedReviewersCount: number;
};

type SyncReviewCyclesOptions = {
  /** Start of the window to scan. Defaults to the last 24 hours. */
  sinceDate?: Date;
  /** Optional inclusive end of the window, used by the backfill. */
  untilDate?: Date;
};

/** The reviewer fields that are derived from cycles and GitHub authored PRs. */
type ReviewerMetrics = Pick<
  ReviewerDocument,
  | "completedReviews"
  | "reviewedPrCount"
  | "completedReviewSubmissions"
  | "approvedPrCount"
  | "authoredPrCount"
  | "avgReviewTimeHours"
  | "avgTimeToApprovalHours"
  | "avgReviewRoundsBeforeApproval"
  | "avgCommentsPerReview"
  | "avgReviewsPerWeek"
>;

const METRIC_KEYS: Array<keyof ReviewerMetrics> = [
  "completedReviews",
  "reviewedPrCount",
  "completedReviewSubmissions",
  "approvedPrCount",
  "authoredPrCount",
  "avgReviewTimeHours",
  "avgTimeToApprovalHours",
  "avgReviewRoundsBeforeApproval",
  "avgCommentsPerReview",
  "avgReviewsPerWeek",
];

/**
 * Derives a reviewer's metrics from their cycle aggregates.
 *
 * @param agg The reviewer's cycle aggregates, if any.
 * @param existing The currently stored reviewer document, if any.
 * @param authoredPrCount The reviewer's authored PR count from GitHub.
 * @returns The metrics to persist.
 */
function buildReviewerMetrics(
  agg: ReviewCycleAggregate | undefined,
  existing: ReviewerDocument | null,
  authoredPrCount: number | undefined,
): ReviewerMetrics {
  const avgReviewTimeHours = !agg
    ? (existing?.avgReviewTimeHours ?? null)
    : agg.completedReviews > 0
      ? Number(
          (agg.totalReviewTimeMs / agg.completedReviews / 3_600_000).toFixed(1),
        )
      : null;

  const avgReviewRoundsBeforeApproval = !agg
    ? (existing?.avgReviewRoundsBeforeApproval ?? null)
    : agg.approvedPrCount > 0
      ? Number((agg.totalRoundsBeforeApproval / agg.approvedPrCount).toFixed(1))
      : null;

  const avgCommentsPerReview = !agg
    ? (existing?.avgCommentsPerReview ?? null)
    : agg.completedReviews > 0
      ? Number((agg.totalComments / agg.completedReviews).toFixed(1))
      : null;

  const avgTimeToApprovalHours = !agg
    ? (existing?.avgTimeToApprovalHours ?? null)
    : agg.approvalsWithDuration > 0
      ? Number(
          (
            agg.totalApprovalDurationMs /
            agg.approvalsWithDuration /
            3_600_000
          ).toFixed(1),
        )
      : null;

  const avgReviewsPerWeek = !agg
    ? (existing?.avgReviewsPerWeek ?? null)
    : agg.activeWeeks.size > 0
      ? Number(
          (agg.completedReviewSubmissions / agg.activeWeeks.size).toFixed(2),
        )
      : null;

  return {
    completedReviews: agg?.completedReviews ?? existing?.completedReviews ?? 0,
    reviewedPrCount: agg?.reviewedPrCount ?? existing?.reviewedPrCount ?? 0,
    completedReviewSubmissions:
      agg?.completedReviewSubmissions ??
      existing?.completedReviewSubmissions ??
      0,
    approvedPrCount: agg?.approvedPrCount ?? existing?.approvedPrCount ?? 0,
    authoredPrCount: authoredPrCount ?? existing?.authoredPrCount ?? 0,
    avgReviewTimeHours,
    avgTimeToApprovalHours,
    avgReviewRoundsBeforeApproval,
    avgCommentsPerReview,
    avgReviewsPerWeek,
  };
}

/**
 * Checks whether two metric snapshots hold the same values.
 *
 * @param left The current metrics.
 * @param right The newly computed metrics.
 * @returns True when every derived field is unchanged.
 */
function metricsEqual(left: ReviewerMetrics, right: ReviewerMetrics): boolean {
  return METRIC_KEYS.every((key) => left[key] === right[key]);
}

/**
 * Recomputes stored metrics from review cycle records.
 *
 * When a set of logins is provided, only those reviewers are read and
 * written. The daily sync uses this to touch just the reviewers whose cycles
 * or authored PRs changed in the window, instead of scanning every cycle and
 * rewriting every reviewer document.
 *
 * @param logins The reviewers to refresh. Omit to refresh every known reviewer.
 * @param contributions Per-reviewer cycle contributions from this invocation.
 * @param rebuildFromCycles Whether to rebuild aggregate state from history.
 * @param platform The repository platform the reviewers belong to.
 * @returns The number of reviewer documents actually written.
 */
export async function refreshReviewerStats(
  logins?: Iterable<string>,
  contributions: Map<string, ReviewCycleLoginContribution> = new Map(),
  rebuildFromCycles = false,
  platform: ContributionPlatform = REVIEWER_REPORT_PLATFORM,
): Promise<number> {
  const knownLogins = await getReviewerTeamLogins();
  if (knownLogins.size === 0) return 0;

  const requestedLogins = logins
    ? Array.from(new Set(logins))
    : Array.from(knownLogins);
  const targetLogins = requestedLogins.filter((login) =>
    knownLogins.has(login),
  );
  if (targetLogins.length === 0) return 0;

  const [aggregateDocuments, reviewerDocs, authoredCounts] = await Promise.all([
    rebuildFromCycles
      ? Promise.resolve(new Map())
      : getReviewerCycleAggregates(platform, targetLogins),
    getReviewers(platform, targetLogins),
    fetchAuthoredPrCounts(targetLogins),
  ]);

  const missingLogins = rebuildFromCycles
    ? targetLogins
    : targetLogins.filter((login) => !aggregateDocuments.has(login));
  const bootstrapped =
    missingLogins.length > 0
      ? await getReviewCycleAggregatesForLogins(platform, missingLogins)
      : new Map<string, ReviewCycleAggregate>();
  const aggregates = new Map<string, ReviewCycleAggregate>();
  const aggregateWrites: Array<{
    login: string;
    aggregate: ReviewerCycleAggregateWrite;
  }> = [];

  for (const login of targetLogins) {
    const stored = aggregateDocuments.get(login);

    if (!stored) {
      // A bootstrap query already includes cycles written in this invocation,
      // so the contribution must not be applied again for these logins.
      const bootstrappedAggregate = bootstrapped.get(login);
      const aggregate = bootstrappedAggregate
        ? reviewCycleAggregateToDocument(platform, bootstrappedAggregate)
        : createEmptyReviewerCycleAggregate(platform);

      aggregateWrites.push({ login, aggregate });
      aggregates.set(login, aggregateDocumentToReviewCycleAggregate(aggregate));
      continue;
    }

    const contribution = contributions.get(login);
    const aggregate = contribution
      ? applyReviewCycleContribution(stored, contribution)
      : stored;

    if (contribution) {
      aggregateWrites.push({ login, aggregate });
    }
    aggregates.set(login, aggregateDocumentToReviewCycleAggregate(aggregate));
  }

  await upsertReviewerCycleAggregates(platform, aggregateWrites);

  const updates: Array<{
    login: string;
    doc: Omit<ReviewerDocument, "schemaVersion">;
  }> = [];

  for (const login of targetLogins) {
    const existing = reviewerDocs.get(login) ?? null;
    const metrics = buildReviewerMetrics(
      aggregates.get(login),
      existing,
      authoredCounts.get(login),
    );

    if (existing && metricsEqual(existing, metrics)) continue;

    updates.push({
      login,
      doc: {
        platform,
        teams: existing?.teams ?? [],
        pendingReviews: existing?.pendingReviews ?? [],
        ...metrics,
        lastUpdated: new Date(),
      },
    });
  }

  await upsertReviewers(platform, updates);

  return updates.length;
}

/**
 * Syncs completed review cycles from GitHub into Firestore.
 *
 * Processes open PRs updated in the sync window + PRs closed within the
 * window, extracts completed cycles from their timelines, and writes:
 * - `reviewCycles/{platform}_{login}:{pr}:{assignedAt}` — completed cycles
 *   (idempotent merge)
 * - `reviewers/{platform}_{login}` — refreshes the reviewers that were active in
 *   the window (cycle authors) or authored one of the scanned PRs. Reviewers
 *   outside that set are left untouched.
 * - `reviewCyclePrStats/{platform}_{pr}` and
 *   `reviewCycleMonthlyReviewers/{platform}_{month}` — bounded incremental
 *   inputs updated when the window produced cycle records.
 * - `reviewCycleAnalytics/{platform}` — folds the new facts into the platform's
 *   analytics snapshot, so dashboard reads stay a single document fetch.
 *
 * Only persists cycles for reviewers who belong to a reviewer team.
 *
 * @param options Optional sync settings.
 * @returns A summary of the sync operation.
 */
export async function syncReviewCycles(
  options?: SyncReviewCyclesOptions,
): Promise<SyncSummary> {
  const platform = REVIEWER_REPORT_PLATFORM;
  const sinceDate =
    options?.sinceDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [openResult, closedResult, knownLogins] = await Promise.all([
    fetchCycleRecords(sinceDate, options?.untilDate),
    fetchClosedPRCycleRecords(sinceDate, options?.untilDate),
    getReviewerTeamLogins(),
  ]);

  const allCompleted = [...openResult.completed, ...closedResult.completed];

  const filtered = allCompleted.filter((c) =>
    knownLogins.has(normalizeGithubUsername(c.reviewerLogin)),
  );

  const newRecords = await createNewReviewCycles(
    platform,
    filtered.map((cycle) => ({
      ...cycle,
      reviewerLogin: normalizeGithubUsername(cycle.reviewerLogin),
      platform,
    })),
  );

  const affectedLogins = new Set<string>();
  for (const cycle of filtered) {
    affectedLogins.add(normalizeGithubUsername(cycle.reviewerLogin));
  }
  for (const login of openResult.authorLogins) {
    affectedLogins.add(normalizeGithubUsername(login));
  }
  for (const login of closedResult.authorLogins) {
    affectedLogins.add(normalizeGithubUsername(login));
  }

  const contributions = await applyReviewCycleContributions(
    platform,
    newRecords,
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

  return {
    completedCyclesCount: allCompleted.length,
    newCyclesCount: newRecords.length,
    updatedReviewersCount,
  };
}

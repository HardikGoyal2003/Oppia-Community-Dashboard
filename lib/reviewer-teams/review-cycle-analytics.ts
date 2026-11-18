import { DbValidationError } from "@/db/db.errors";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import type {
  ReviewerApprovalShare,
  ReviewerTeamsAnalytics,
  ReviewCycleRecord,
} from "@/lib/domain/reviewer-teams.types";
import {
  getIstDateKey,
  getIstWeekStartDateKey,
  parseDateValue,
  parseTimestampMs,
} from "@/lib/utils/date.utils";
import type {
  ReviewCyclePrReviewerFact,
  ReviewCyclePrStatsDocument,
} from "@/db/review-cycle-pr-stats/review-cycle-pr-stats.mapper";

/**
 * The subset of a PR stats document needed to build the scatter chart.
 */
export type PrScatterSource = {
  prNumber: number;
  additions: number | null;
  firstAssignedAt: string | null;
  lastApprovedAt: string | null;
};

/**
 * Aggregated per-reviewer stats derived from review cycles.
 */
export type ReviewCycleAggregate = {
  /** Completed review cycles (assignment → first review or unassignment). */
  completedReviews: number;
  /** Distinct PRs reviewed at least once. */
  reviewedPrCount: number;
  /** Distinct PRs where the reviewer approved at least once. */
  approvedPrCount: number;
  totalReviewTimeMs: number;
  totalRoundsBeforeApproval: number;
  totalComments: number;
  /** Sum of counted review submissions across all cycles. */
  completedReviewSubmissions: number;
  totalApprovalDurationMs: number;
  /** Cycles that include an approval timestamp. */
  approvalsWithDuration: number;
  /** Distinct ISO weeks in which the reviewer submitted a review. */
  activeWeeks: Set<string>;
};

/**
 * Incremental contribution of a batch of cycles for one reviewer.
 *
 * `newFacts` only contains reviewer-PR pairs that were not counted before, so
 * PR-level metrics are only counted once per reviewer-PR.
 */
export type ReviewCycleLoginContribution = {
  completedReviews: number;
  totalReviewTimeMs: number;
  totalApprovalDurationMs: number;
  approvalsWithDuration: number;
  newFacts: ReviewCyclePrReviewerFact[];
};

/**
 * Number of most recent PRs kept in the dashboard scatter snapshot.
 *
 * The scatter is a visualization, so it is capped to keep the analytics
 * document bounded. Full per-PR stats stay in `reviewCyclePrStats`.
 */
export const PR_SIZE_SCATTER_LIMIT = 400;

/**
 * Creates a zeroed per-reviewer aggregate.
 *
 * @returns An aggregate with every counter reset.
 */
export function createEmptyAggregate(): ReviewCycleAggregate {
  return {
    completedReviews: 0,
    reviewedPrCount: 0,
    approvedPrCount: 0,
    totalReviewTimeMs: 0,
    totalRoundsBeforeApproval: 0,
    totalComments: 0,
    completedReviewSubmissions: 0,
    totalApprovalDurationMs: 0,
    approvalsWithDuration: 0,
    activeWeeks: new Set<string>(),
  };
}

/**
 * Merges one cycle document into the per-reviewer aggregates.
 *
 * @param aggregates The aggregate map to update.
 * @param seenPRsByReviewer The per-reviewer set of PRs already counted.
 * @param data The cycle document to accumulate.
 * @returns Nothing. The maps are mutated in place.
 */
function accumulateCycle(
  aggregates: Map<string, ReviewCycleAggregate>,
  seenPRsByReviewer: Map<string, Set<number>>,
  data: ReviewCycleRecord,
): void {
  const login = data.reviewerLogin;
  const existing = aggregates.get(login) ?? createEmptyAggregate();

  existing.completedReviews++;
  existing.totalReviewTimeMs += data.durationMs;

  if (data.approvalDurationMs !== null) {
    existing.totalApprovalDurationMs += data.approvalDurationMs;
    existing.approvalsWithDuration++;
  }

  const seenPRs = seenPRsByReviewer.get(login) ?? new Set<number>();
  if (!seenPRs.has(data.prNumber)) {
    seenPRs.add(data.prNumber);
    seenPRsByReviewer.set(login, seenPRs);

    existing.reviewedPrCount++;
    existing.completedReviewSubmissions += data.reviewSubmissionCount ?? 0;
    if ((data.reviewSubmissionCount ?? 0) > 0) {
      const completedAt = parseDateValue(data.completedAt);

      if (completedAt) {
        existing.activeWeeks.add(getIstWeekStartDateKey(completedAt));
      }
    }

    if (data.reviewRoundsBeforeApproval !== null) {
      existing.totalRoundsBeforeApproval += data.reviewRoundsBeforeApproval;
      existing.approvedPrCount++;
    }
    existing.totalComments += data.commentCount;
  }

  aggregates.set(login, existing);
}

/**
 * Aggregates a set of cycle records into per-reviewer stats.
 *
 * Deduplicates per-PR stats (reviewRoundsBeforeApproval, commentCount)
 * by PR number since multiple cycles can exist for the same reviewer
 * on the same PR.
 *
 * @param records The cycle records to aggregate.
 * @returns A map of login to aggregate stats.
 */
export function aggregateCycleRecords(
  records: ReviewCycleRecord[],
): Map<string, ReviewCycleAggregate> {
  const aggregates = new Map<string, ReviewCycleAggregate>();
  const seenPRsByReviewer = new Map<string, Set<number>>();

  for (const record of records) {
    accumulateCycle(aggregates, seenPRsByReviewer, record);
  }

  return aggregates;
}

/**
 * Builds a reviewer-PR fact from a cycle record.
 *
 * @param record The cycle record.
 * @returns The reviewer-PR fact.
 */
export function buildReviewerFact(
  record: Omit<ReviewCycleRecord, "schemaVersion">,
): ReviewCyclePrReviewerFact {
  const completedAt = parseDateValue(record.completedAt);

  if (!completedAt) {
    throw new DbValidationError(
      "completedAt",
      "Review cycle completedAt must be a valid date.",
    );
  }

  return {
    weekStart: getIstWeekStartDateKey(completedAt),
    month: getIstDateKey(completedAt).slice(0, 7),
    submissions: record.reviewSubmissionCount,
    roundsBeforeApproval: record.reviewRoundsBeforeApproval,
    comments: record.commentCount,
    approved: record.reviewRoundsBeforeApproval !== null,
  };
}

/**
 * Returns the earlier of two ISO timestamps, ignoring missing values.
 *
 * @param current The currently stored timestamp.
 * @param candidate The timestamp to compare with it.
 * @returns The earlier timestamp, or whichever value is present.
 */
export function earlierTimestamp(
  current: string | null,
  candidate: string | null,
): string | null {
  if (current === null) return candidate;
  if (candidate === null) return current;
  return candidate < current ? candidate : current;
}

/**
 * Returns the later of two ISO timestamps, ignoring missing values.
 *
 * @param current The currently stored timestamp.
 * @param candidate The timestamp to compare with it.
 * @returns The later timestamp, or whichever value is present.
 */
export function laterTimestamp(
  current: string | null,
  candidate: string | null,
): string | null {
  if (current === null) return candidate;
  if (candidate === null) return current;
  return candidate > current ? candidate : current;
}

/**
 * Converts per-PR facts into a fresh PR stats document.
 *
 * @param prNumber The PR number.
 * @returns An empty PR stats document.
 */
export function createPrStatsDocument(
  prNumber: number,
): Omit<ReviewCyclePrStatsDocument, "schemaVersion"> {
  return {
    prNumber,
    additions: null,
    firstAssignedAt: null,
    lastApprovedAt: null,
    reviewers: {},
    lastUpdated: new Date(),
  };
}

/**
 * Returns whether a PR stats entry can be plotted on the approval scatter.
 *
 * @param stats The PR stats to check.
 * @returns True when the PR has a size and both timing endpoints.
 */
function hasApprovalTiming(stats: PrScatterSource): stats is PrScatterSource & {
  additions: number;
  firstAssignedAt: string;
  lastApprovedAt: string;
} {
  return (
    stats.additions !== null &&
    stats.firstAssignedAt !== null &&
    stats.lastApprovedAt !== null
  );
}

/**
 * Builds the capped PR-size scatter from PR stats.
 *
 * @param prStats PR stats used as scatter inputs.
 * @returns Scatter points for the most recent approved PRs, sorted by size.
 */
export function buildScatter(
  prStats: Iterable<PrScatterSource>,
): ReviewerTeamsAnalytics["prSizeScatter"] {
  return Array.from(prStats)
    .filter(hasApprovalTiming)
    .sort((a, b) => b.prNumber - a.prNumber)
    .slice(0, PR_SIZE_SCATTER_LIMIT)
    .map((stats) => {
      const approvedAtMs = parseTimestampMs(stats.lastApprovedAt);
      const assignedAtMs = parseTimestampMs(stats.firstAssignedAt);

      return {
        prNumber: stats.prNumber,
        additions: stats.additions,
        reviewTimeHours:
          approvedAtMs === null || assignedAtMs === null
            ? 0
            : Math.max(0, approvedAtMs - assignedAtMs) / 3_600_000,
      };
    })
    .sort((a, b) => a.additions - b.additions);
}

/**
 * Assembles the dashboard analytics payload from its bounded inputs.
 *
 * @param weeklyReviews Weekly submission counts keyed by week start.
 * @param monthlyLogins Reviewer logins keyed by month.
 * @param approvalsByReviewer Approval counts keyed by reviewer login.
 * @param prStats PR stats used to build the scatter chart.
 * @returns The analytics payload.
 */
export function buildAnalytics(
  weeklyReviews: Map<string, number>,
  monthlyLogins: Map<string, Set<string>>,
  approvalsByReviewer: Map<string, number>,
  prStats: Iterable<PrScatterSource>,
): ReviewerTeamsAnalytics {
  const totalApprovals = Array.from(approvalsByReviewer.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  const topApprovers: ReviewerApprovalShare[] = Array.from(
    approvalsByReviewer.entries(),
  )
    .map(([username, approvals]) => ({
      username,
      approvals,
      sharePct: totalApprovals === 0 ? 0 : (approvals / totalApprovals) * 100,
    }))
    .sort((a, b) => b.approvals - a.approvals);

  return {
    weeklyReviews: Array.from(weeklyReviews.entries())
      .map(([weekStart, reviews]) => ({ weekStart, reviews }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    monthlyUniqueReviewers: Array.from(monthlyLogins.entries())
      .map(([month, logins]) => ({
        month,
        uniqueReviewers: logins.size,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topApprovers,
    prSizeScatter: buildScatter(prStats),
    totalApprovals,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS),
  };
}

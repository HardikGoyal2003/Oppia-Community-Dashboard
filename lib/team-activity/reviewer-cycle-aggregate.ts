import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import type {
  ReviewCycleAggregate,
  ReviewCycleLoginContribution,
} from "@/lib/reviewer-teams/review-cycle-analytics";
import type { ReviewerCycleAggregateDocument } from "@/db/reviewer-cycle-aggregates/reviewer-cycle-aggregates.mapper";

/**
 * Creates an empty persisted reviewer aggregate.
 *
 * @returns An empty aggregate document.
 */
export function createEmptyReviewerCycleAggregate(): ReviewerCycleAggregateDocument {
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
    activeWeeks: [],
    lastUpdated: new Date(),
    schemaVersion: getCurrentSchemaVersion(
      SCHEMA_KEYS.REVIEWER_CYCLE_AGGREGATES,
    ),
  };
}

/**
 * Applies one batch of cycle contributions to a reviewer aggregate immutably.
 *
 * Per-cycle counters are always added. PR-level metrics are taken from the
 * facts of newly counted reviewer-PR pairs, which are derived from
 * `reviewCyclePrStats`, so each reviewer-PR is only counted once.
 *
 * @param aggregate The existing aggregate document.
 * @param contribution The contribution for this reviewer.
 * @returns A new updated aggregate document.
 */
export function applyReviewCycleContribution(
  aggregate: ReviewerCycleAggregateDocument,
  contribution: ReviewCycleLoginContribution,
): ReviewerCycleAggregateDocument {
  const weeks = new Set(aggregate.activeWeeks);
  let reviewedPrCount = aggregate.reviewedPrCount;
  let approvedPrCount = aggregate.approvedPrCount;
  let totalRoundsBeforeApproval = aggregate.totalRoundsBeforeApproval;
  let totalComments = aggregate.totalComments;
  let completedReviewSubmissions = aggregate.completedReviewSubmissions;

  for (const fact of contribution.newFacts) {
    reviewedPrCount++;
    completedReviewSubmissions += fact.submissions;
    totalComments += fact.comments;

    if (fact.submissions > 0) {
      weeks.add(fact.weekStart);
    }

    if (fact.roundsBeforeApproval !== null) {
      approvedPrCount++;
      totalRoundsBeforeApproval += fact.roundsBeforeApproval;
    }
  }

  return {
    ...aggregate,
    completedReviews:
      aggregate.completedReviews + contribution.completedReviews,
    reviewedPrCount,
    approvedPrCount,
    totalReviewTimeMs:
      aggregate.totalReviewTimeMs + contribution.totalReviewTimeMs,
    totalRoundsBeforeApproval,
    totalComments,
    completedReviewSubmissions,
    totalApprovalDurationMs:
      aggregate.totalApprovalDurationMs + contribution.totalApprovalDurationMs,
    approvalsWithDuration:
      aggregate.approvalsWithDuration + contribution.approvalsWithDuration,
    activeWeeks: Array.from(weeks),
    lastUpdated: new Date(),
  };
}

/**
 * Converts a stored aggregate into the calculation model.
 *
 * @param document The stored aggregate document.
 * @returns The calculation aggregate.
 */
export function aggregateDocumentToReviewCycleAggregate(
  document: ReviewerCycleAggregateDocument,
): ReviewCycleAggregate {
  return {
    completedReviews: document.completedReviews,
    reviewedPrCount: document.reviewedPrCount,
    approvedPrCount: document.approvedPrCount,
    totalReviewTimeMs: document.totalReviewTimeMs,
    totalRoundsBeforeApproval: document.totalRoundsBeforeApproval,
    totalComments: document.totalComments,
    completedReviewSubmissions: document.completedReviewSubmissions,
    totalApprovalDurationMs: document.totalApprovalDurationMs,
    approvalsWithDuration: document.approvalsWithDuration,
    activeWeeks: new Set(document.activeWeeks),
  };
}

/**
 * Converts a calculation aggregate into a stored aggregate document.
 *
 * @param aggregate The calculation aggregate.
 * @returns The stored aggregate document.
 */
export function reviewCycleAggregateToDocument(
  aggregate: ReviewCycleAggregate,
): ReviewerCycleAggregateDocument {
  return {
    completedReviews: aggregate.completedReviews,
    reviewedPrCount: aggregate.reviewedPrCount,
    approvedPrCount: aggregate.approvedPrCount,
    totalReviewTimeMs: aggregate.totalReviewTimeMs,
    totalRoundsBeforeApproval: aggregate.totalRoundsBeforeApproval,
    totalComments: aggregate.totalComments,
    completedReviewSubmissions: aggregate.completedReviewSubmissions,
    totalApprovalDurationMs: aggregate.totalApprovalDurationMs,
    approvalsWithDuration: aggregate.approvalsWithDuration,
    activeWeeks: Array.from(aggregate.activeWeeks),
    lastUpdated: new Date(),
    schemaVersion: getCurrentSchemaVersion(
      SCHEMA_KEYS.REVIEWER_CYCLE_AGGREGATES,
    ),
  };
}

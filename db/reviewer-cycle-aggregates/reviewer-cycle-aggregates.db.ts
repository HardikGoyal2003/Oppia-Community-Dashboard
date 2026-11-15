import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import type {
  ReviewCycleAggregate,
  ReviewCycleLoginContribution,
} from "@/db/review-cycles/review-cycles.db";
import {
  normalizeReviewerCycleAggregate,
  serializeReviewerCycleAggregate,
  type ReviewerCycleAggregateDocument,
} from "./reviewer-cycle-aggregates.mapper";

const db = getAdminFirestore();
const collection = db.collection(DB_PATHS.REVIEWER_CYCLE_AGGREGATES.COLLECTION);

/**
 * Creates an empty persisted reviewer aggregate.
 *
 * The aggregate stores counters plus the set of active weeks. PR membership
 * lives in `reviewCyclePrStats`, so this document does not grow with the
 * number of PRs a reviewer has worked on.
 *
 * @returns An empty aggregate.
 */
function emptyAggregate(): ReviewerCycleAggregateDocument {
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
 * Reads aggregate documents for the supplied reviewer logins.
 * @param logins Reviewer logins to read.
 * @returns Aggregates keyed by login.
 */
export async function getReviewerCycleAggregates(
  logins: string[],
): Promise<Map<string, ReviewerCycleAggregateDocument>> {
  const result = new Map<string, ReviewerCycleAggregateDocument>();
  if (logins.length === 0) return result;
  const snapshots = await db.getAll(
    ...logins.map((login) => collection.doc(login)),
  );
  snapshots.forEach((snapshot, index) => {
    const data = snapshot.data();
    if (snapshot.exists && data) {
      result.set(logins[index], normalizeReviewerCycleAggregate(data));
    }
  });
  return result;
}

/**
 * Writes reviewer aggregate documents in one batch.
 * @param entries Aggregates keyed by reviewer login.
 * @returns A promise that resolves after the write.
 */
export async function upsertReviewerCycleAggregates(
  entries: Array<{ login: string; aggregate: ReviewerCycleAggregateDocument }>,
): Promise<void> {
  if (entries.length === 0) return;
  const batch = db.batch();
  for (const entry of entries) {
    batch.set(
      collection.doc(entry.login),
      serializeReviewerCycleAggregate(entry.aggregate),
    );
  }
  await batch.commit();
}

/**
 * Applies one batch of cycle contributions to a reviewer aggregate.
 *
 * Per-cycle counters are always added. PR-level metrics are taken from the
 * facts of newly counted reviewer-PR pairs, which are derived from
 * `reviewCyclePrStats`, so each reviewer-PR is only counted once.
 *
 * @param aggregate Aggregate to mutate.
 * @param contribution The contribution for this reviewer.
 * @returns The updated aggregate.
 */
export function applyReviewCycleContribution(
  aggregate: ReviewerCycleAggregateDocument,
  contribution: ReviewCycleLoginContribution,
): ReviewerCycleAggregateDocument {
  aggregate.completedReviews += contribution.completedReviews;
  aggregate.totalReviewTimeMs += contribution.totalReviewTimeMs;
  aggregate.totalApprovalDurationMs += contribution.totalApprovalDurationMs;
  aggregate.approvalsWithDuration += contribution.approvalsWithDuration;

  const weeks = new Set(aggregate.activeWeeks);

  for (const fact of contribution.newFacts) {
    aggregate.reviewedPrCount++;
    aggregate.completedReviewSubmissions += fact.submissions;
    aggregate.totalComments += fact.comments;

    if (fact.submissions > 0) {
      weeks.add(fact.weekStart);
    }

    if (fact.roundsBeforeApproval !== null) {
      aggregate.approvedPrCount++;
      aggregate.totalRoundsBeforeApproval += fact.roundsBeforeApproval;
    }
  }

  aggregate.activeWeeks = Array.from(weeks);
  aggregate.lastUpdated = new Date();
  return aggregate;
}

/**
 * Creates a new empty reviewer aggregate.
 * @returns A new empty aggregate.
 */
export function createEmptyReviewerCycleAggregate(): ReviewerCycleAggregateDocument {
  return emptyAggregate();
}

/**
 * Converts a stored aggregate into the calculation model.
 * @param document Stored aggregate document.
 * @returns Calculation aggregate.
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
 * @param aggregate Calculation aggregate.
 * @returns Stored aggregate document.
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

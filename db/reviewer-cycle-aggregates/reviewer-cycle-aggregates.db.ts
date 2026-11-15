import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import type { ReviewCycleRecord } from "@/lib/domain/reviewer-teams.types";
import type { ReviewCycleAggregate } from "@/db/review-cycles/review-cycles.db";
import { getIstWeekStartDateKey } from "@/lib/utils/date.utils";
import {
  normalizeReviewerCycleAggregate,
  serializeReviewerCycleAggregate,
  type ReviewerCycleAggregateDocument,
} from "./reviewer-cycle-aggregates.mapper";

const db = getAdminFirestore();
const collection = db.collection(DB_PATHS.REVIEWER_CYCLE_AGGREGATES.COLLECTION);

/**
 * Creates an empty persisted reviewer aggregate.
 * @returns An empty aggregate.
 */
function emptyAggregate(): ReviewerCycleAggregateDocument {
  return {
    completedReviews: 0,
    reviewedPrNumbers: [],
    approvedPrNumbers: [],
    totalReviewTimeMs: 0,
    totalRoundsBeforeApproval: 0,
    totalComments: 0,
    completedReviewSubmissions: 0,
    totalApprovalDurationMs: 0,
    approvalsWithDuration: 0,
    activeWeeks: [],
    lastUpdated: new Date(),
    schemaVersion: 1,
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
    if (snapshot.exists && snapshot.data()) {
      result.set(
        logins[index],
        normalizeReviewerCycleAggregate(snapshot.data()!),
      );
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
 * Merges newly persisted cycles into one reviewer aggregate.
 * @param aggregate Aggregate to mutate.
 * @param records New cycles for the reviewer.
 * @returns The updated aggregate.
 */
export function mergeCyclesIntoAggregate(
  aggregate: ReviewerCycleAggregateDocument,
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): ReviewerCycleAggregateDocument {
  const reviewed = new Set(aggregate.reviewedPrNumbers);
  const approved = new Set(aggregate.approvedPrNumbers);
  const weeks = new Set(aggregate.activeWeeks);

  for (const record of records) {
    aggregate.completedReviews++;
    aggregate.totalReviewTimeMs += record.durationMs;
    if (!reviewed.has(record.prNumber)) {
      reviewed.add(record.prNumber);
      aggregate.totalComments += record.commentCount;
      aggregate.completedReviewSubmissions += record.reviewSubmissionCount;
      if (record.reviewSubmissionCount > 0) {
        weeks.add(getIstWeekStartDateKey(new Date(record.completedAt)));
      }
      if (record.reviewRoundsBeforeApproval !== null) {
        approved.add(record.prNumber);
        aggregate.totalRoundsBeforeApproval +=
          record.reviewRoundsBeforeApproval;
      }
    }
    if (record.approvalDurationMs !== null) {
      aggregate.totalApprovalDurationMs += record.approvalDurationMs;
      aggregate.approvalsWithDuration++;
    }
  }

  aggregate.reviewedPrNumbers = Array.from(reviewed);
  aggregate.approvedPrNumbers = Array.from(approved);
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
    reviewedPrs: new Set(document.reviewedPrNumbers),
    approvedPrs: new Set(document.approvedPrNumbers),
    totalReviewTimeMs: document.totalReviewTimeMs,
    totalRoundsBeforeApproval: document.totalRoundsBeforeApproval,
    approvedPrCount: document.approvedPrNumbers.length,
    totalComments: document.totalComments,
    completedReviewSubmissions: document.completedReviewSubmissions,
    totalApprovalDurationMs: document.totalApprovalDurationMs,
    approvalsWithDuration: document.approvalsWithDuration,
    activeWeeks: new Set(document.activeWeeks),
  };
}

/**
 * Converts a legacy calculation aggregate into a stored aggregate document.
 * @param aggregate Legacy aggregate.
 * @returns Stored aggregate document.
 */
export function reviewCycleAggregateToDocument(
  aggregate: ReviewCycleAggregate,
): ReviewerCycleAggregateDocument {
  return {
    completedReviews: aggregate.completedReviews,
    reviewedPrNumbers: Array.from(aggregate.reviewedPrs),
    approvedPrNumbers: Array.from(aggregate.approvedPrs),
    totalReviewTimeMs: aggregate.totalReviewTimeMs,
    totalRoundsBeforeApproval: aggregate.totalRoundsBeforeApproval,
    totalComments: aggregate.totalComments,
    completedReviewSubmissions: aggregate.completedReviewSubmissions,
    totalApprovalDurationMs: aggregate.totalApprovalDurationMs,
    approvalsWithDuration: aggregate.approvalsWithDuration,
    activeWeeks: Array.from(aggregate.activeWeeks),
    lastUpdated: new Date(),
    schemaVersion: 1,
  };
}

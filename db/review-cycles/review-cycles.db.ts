import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DbValidationError } from "@/db/db.errors";
import type {
  ReviewerApprovalShare,
  ReviewerTeamsAnalytics,
  ReviewCycleRecord,
} from "@/lib/domain/reviewer-teams.types";
import { getIstDateKey, getIstWeekStartDateKey } from "@/lib/utils/date.utils";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreReviewCycle,
  serializeReviewCycle,
} from "./review-cycles.mapper";
import {
  type FirestoreReviewCycleAnalytics,
  normalizeReviewCycleAnalytics,
  serializeReviewCycleAnalytics,
} from "./review-cycle-analytics.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEW_CYCLES.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewCycle>;
const analyticsDoc = db
  .collection(DB_PATHS.REVIEW_CYCLE_ANALYTICS.COLLECTION)
  .doc(
    DB_PATHS.REVIEW_CYCLE_ANALYTICS.SNAPSHOT_DOC,
  ) as FirebaseFirestore.DocumentReference<FirestoreReviewCycleAnalytics>;

/** Firestore `in` filters accept at most 30 comparison values. */
const AGGREGATE_LOGIN_CHUNK_SIZE = 30;

/**
 * Batch upserts multiple review cycle records.
 *
 * Firestore caps a single batch at 500 writes, so records are committed in
 * chunks. A 2-month backfill can produce well over that limit.
 *
 * @param records The cycle records to persist.
 * @returns A promise that resolves when all batch writes complete.
 */
export async function upsertReviewCycles(
  records: ReviewCycleRecord[],
): Promise<void> {
  const BATCH_SIZE = 400;

  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    const batch = db.batch();

    for (const record of records.slice(start, start + BATCH_SIZE)) {
      const key = `${record.reviewerLogin}:${record.prNumber}:${record.assignedAt}`;
      batch.set(collection.doc(key), serializeReviewCycle(record), {
        merge: true,
      });
    }

    await batch.commit();
  }
}

/**
 * Given a list of candidate cycle records, returns only those whose
 * corresponding Firestore doc does not yet exist.
 *
 * Uses composite key `${reviewerLogin}:${prNumber}:${assignedAt}`.
 *
 * @param records The candidate cycle records.
 * @returns The subset of records that are new (not yet in Firestore).
 */
export async function findNewCycleRecords(
  records: ReviewCycleRecord[],
): Promise<ReviewCycleRecord[]> {
  if (records.length === 0) return [];

  const firestore = getAdminFirestore();
  const GET_ALL_CHUNK_SIZE = 300;
  const newRecords: ReviewCycleRecord[] = [];

  for (let start = 0; start < records.length; start += GET_ALL_CHUNK_SIZE) {
    const chunk = records.slice(start, start + GET_ALL_CHUNK_SIZE);
    const refs = chunk.map((r) =>
      collection.doc(`${r.reviewerLogin}:${r.prNumber}:${r.assignedAt}`),
    );

    const snapshots = await firestore.getAll(...refs);

    chunk.forEach((record, i) => {
      if (!snapshots[i].exists) newRecords.push(record);
    });
  }

  return newRecords;
}

/**
 * Aggregated per-reviewer stats derived from all stored review cycles.
 */
export type ReviewCycleAggregate = {
  /** Completed review cycles (assignment → first review or unassignment). */
  completedReviews: number;
  /** Distinct PRs reviewed at least once. */
  reviewedPrs: Set<number>;
  totalReviewTimeMs: number;
  totalRoundsBeforeApproval: number;
  /** Distinct PRs where the reviewer approved at least once. */
  approvedPrCount: number;
  totalComments: number;
  /** Sum of non-pending review submissions across all cycles. */
  completedReviewSubmissions: number;
  totalApprovalDurationMs: number;
  /** Cycles that include an approval timestamp. */
  approvalsWithDuration: number;
  /** Distinct ISO weeks in which the reviewer submitted a review. */
  activeWeeks: Set<string>;
};

/**
 * Creates a zeroed per-reviewer aggregate.
 *
 * @returns An aggregate with every counter reset.
 */
function createEmptyAggregate(): ReviewCycleAggregate {
  return {
    completedReviews: 0,
    reviewedPrs: new Set<number>(),
    totalReviewTimeMs: 0,
    totalRoundsBeforeApproval: 0,
    approvedPrCount: 0,
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
  data: FirestoreReviewCycle,
): void {
  const login = data.reviewerLogin;
  const existing = aggregates.get(login) ?? createEmptyAggregate();

  existing.completedReviews++;
  existing.reviewedPrs.add(data.prNumber);
  existing.totalReviewTimeMs += data.durationMs;

  if (data.approvalDurationMs !== null) {
    existing.totalApprovalDurationMs += data.approvalDurationMs;
    existing.approvalsWithDuration++;
  }

  const seenPRs = seenPRsByReviewer.get(login) ?? new Set<number>();
  if (!seenPRs.has(data.prNumber)) {
    seenPRs.add(data.prNumber);
    seenPRsByReviewer.set(login, seenPRs);

    existing.completedReviewSubmissions += data.reviewSubmissionCount ?? 0;
    if ((data.reviewSubmissionCount ?? 0) > 0) {
      existing.activeWeeks.add(
        getIstWeekStartDateKey(new Date(data.completedAt)),
      );
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
function aggregateCycleRecords(
  records: FirestoreReviewCycle[],
): Map<string, ReviewCycleAggregate> {
  const aggregates = new Map<string, ReviewCycleAggregate>();
  const seenPRsByReviewer = new Map<string, Set<number>>();

  for (const record of records) {
    accumulateCycle(aggregates, seenPRsByReviewer, record);
  }

  return aggregates;
}

/**
 * Computes aggregate stats for all reviewers from all stored cycles.
 *
 * @returns A map of login to aggregate stats.
 */
export async function getAllReviewCycleAggregates(): Promise<
  Map<string, ReviewCycleAggregate>
> {
  const snapshot = await collection.get();
  return aggregateCycleRecords(snapshot.docs.map((doc) => doc.data()));
}

/**
 * Computes aggregate stats for the given reviewers only.
 *
 * Reads just the cycles belonging to those logins instead of the whole
 * collection, so a daily sync does not scan historical cycles for reviewers
 * it will not update.
 *
 * @param logins The reviewer logins to aggregate.
 * @returns A map of login to aggregate stats.
 */
export async function getReviewCycleAggregatesForLogins(
  logins: string[],
): Promise<Map<string, ReviewCycleAggregate>> {
  const uniqueLogins = Array.from(new Set(logins));
  if (uniqueLogins.length === 0) return new Map();

  const records: FirestoreReviewCycle[] = [];

  for (
    let start = 0;
    start < uniqueLogins.length;
    start += AGGREGATE_LOGIN_CHUNK_SIZE
  ) {
    const chunk = uniqueLogins.slice(start, start + AGGREGATE_LOGIN_CHUNK_SIZE);
    const snapshot = await collection.where("reviewerLogin", "in", chunk).get();

    snapshot.forEach((doc) => records.push(doc.data()));
  }

  return aggregateCycleRecords(records);
}

/**
 * Builds org-wide reviewer analytics from all stored review cycles.
 *
 * @returns Weekly review counts, monthly unique reviewers, top approver
 * concentration, and PR-size vs review-time scatter data.
 */
async function computeReviewCycleAnalytics(): Promise<ReviewerTeamsAnalytics> {
  const snapshot = await collection.get();

  const weeklyReviews = new Map<string, number>();
  const monthlyReviewerSets = new Map<string, Set<string>>();
  const seenSubmissionPRs = new Set<string>();
  const approvalsByReviewer = new Map<string, number>();
  const seenApprovalPRsByReviewer = new Map<string, Set<number>>();
  const prDurations = new Map<
    number,
    { additions: number; totalDurationMs: number; count: number }
  >();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const submissions = data.reviewSubmissionCount ?? 0;

    if (submissions > 0) {
      const completedAt = new Date(data.completedAt);
      const submissionKey = `${data.reviewerLogin}:${data.prNumber}`;

      if (!seenSubmissionPRs.has(submissionKey)) {
        seenSubmissionPRs.add(submissionKey);
        const weekStart = getIstWeekStartDateKey(completedAt);
        weeklyReviews.set(
          weekStart,
          (weeklyReviews.get(weekStart) ?? 0) + submissions,
        );
      }

      const month = getIstDateKey(completedAt).slice(0, 7);
      const reviewers = monthlyReviewerSets.get(month) ?? new Set<string>();
      reviewers.add(data.reviewerLogin);
      monthlyReviewerSets.set(month, reviewers);
    }

    if (data.reviewRoundsBeforeApproval !== null) {
      const seenPRs =
        seenApprovalPRsByReviewer.get(data.reviewerLogin) ?? new Set<number>();
      if (!seenPRs.has(data.prNumber)) {
        seenPRs.add(data.prNumber);
        seenApprovalPRsByReviewer.set(data.reviewerLogin, seenPRs);
        approvalsByReviewer.set(
          data.reviewerLogin,
          (approvalsByReviewer.get(data.reviewerLogin) ?? 0) + 1,
        );
      }
    }

    if (data.prAdditions !== null) {
      const existing = prDurations.get(data.prNumber) ?? {
        additions: data.prAdditions,
        totalDurationMs: 0,
        count: 0,
      };
      existing.totalDurationMs += data.durationMs;
      existing.count++;
      prDurations.set(data.prNumber, existing);
    }
  });

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
    monthlyUniqueReviewers: Array.from(monthlyReviewerSets.entries())
      .map(([month, reviewers]) => ({
        month,
        uniqueReviewers: reviewers.size,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topApprovers,
    prSizeScatter: Array.from(prDurations.entries())
      .map(([prNumber, value]) => ({
        prNumber,
        additions: value.additions,
        reviewTimeHours: value.totalDurationMs / value.count / 3_600_000,
      }))
      .sort((a, b) => a.additions - b.additions),
    totalApprovals,
  };
}

/**
 * Reads the precomputed reviewer analytics snapshot.
 *
 * The dashboard reads this single document instead of scanning the whole
 * review-cycles collection on every page load. The snapshot is refreshed by
 * the cycle sync and the backfill job.
 *
 * @returns The stored analytics, or null when no snapshot exists.
 */
export async function getReviewCycleAnalyticsSnapshot(): Promise<ReviewerTeamsAnalytics | null> {
  const snapshot = await analyticsDoc.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data) return null;

  try {
    return normalizeReviewCycleAnalytics(data);
  } catch (error) {
    if (error instanceof DbValidationError) return null;
    throw error;
  }
}

/**
 * Recomputes org-wide reviewer analytics and persists the snapshot.
 *
 * @returns The freshly computed analytics.
 */
export async function refreshReviewCycleAnalytics(): Promise<ReviewerTeamsAnalytics> {
  const analytics = await computeReviewCycleAnalytics();
  await analyticsDoc.set(serializeReviewCycleAnalytics(analytics));
  return analytics;
}

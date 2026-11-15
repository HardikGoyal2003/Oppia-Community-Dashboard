import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
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
import { getIstDateKey, getIstWeekStartDateKey } from "@/lib/utils/date.utils";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreReviewCycle,
  normalizeReviewCycle,
  serializeReviewCycle,
} from "./review-cycles.mapper";
import {
  type FirestoreReviewCycleAnalytics,
  type ReviewCycleAnalyticsState,
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
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
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
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): Promise<Array<Omit<ReviewCycleRecord, "schemaVersion">>> {
  if (records.length === 0) return [];

  const firestore = getAdminFirestore();
  const GET_ALL_CHUNK_SIZE = 300;
  const newRecords: Array<Omit<ReviewCycleRecord, "schemaVersion">> = [];

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
  approvedPrs: Set<number>;
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
    approvedPrs: new Set<number>(),
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
      existing.approvedPrs.add(data.prNumber);
    }
    existing.totalComments += data.commentCount;
  }

  existing.approvedPrCount = existing.approvedPrs.size;
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
  return aggregateCycleRecords(
    snapshot.docs.map((doc) => normalizeReviewCycle(doc.data())),
  );
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

    snapshot.forEach((doc) => records.push(normalizeReviewCycle(doc.data())));
  }

  return aggregateCycleRecords(records);
}

/**
 * Builds org-wide reviewer analytics from all stored review cycles.
 *
 * @returns Weekly review counts, monthly unique reviewers, top approver
 * concentration, and PR-size vs review-time scatter data.
 */
type StoredAnalytics = ReviewerTeamsAnalytics & {
  analyticsState?: ReviewCycleAnalyticsState;
};

/**
 * Creates empty state for incremental analytics updates.
 *
 * @returns A zeroed analytics state.
 */
function createAnalyticsState(): ReviewCycleAnalyticsState {
  return {
    weeklyReviews: {},
    monthlyReviewerKeys: {},
    submissionKeys: [],
    approvalKeys: [],
    prStats: {},
  };
}

/**
 * Converts internal analytics state into the dashboard response shape.
 *
 * @param state The persisted incremental state.
 * @returns Dashboard analytics derived from the state.
 */
function buildAnalyticsFromState(
  state: ReviewCycleAnalyticsState,
): ReviewerTeamsAnalytics {
  const approvalsByReviewer = new Map<string, number>();
  for (const key of state.approvalKeys) {
    const reviewer = key.slice(0, key.lastIndexOf(":"));
    approvalsByReviewer.set(
      reviewer,
      (approvalsByReviewer.get(reviewer) ?? 0) + 1,
    );
  }

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
    weeklyReviews: Object.entries(state.weeklyReviews)
      .map(([weekStart, reviews]) => ({ weekStart, reviews }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    monthlyUniqueReviewers: Object.entries(state.monthlyReviewerKeys)
      .map(([month, reviewers]) => ({
        month,
        uniqueReviewers: reviewers.length,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topApprovers,
    prSizeScatter: Object.entries(state.prStats)
      .map(([prNumber, value]) => ({
        prNumber: Number(prNumber),
        additions: value.additions,
        reviewTimeHours: value.totalDurationMs / value.count / 3_600_000,
      }))
      .sort((a, b) => a.additions - b.additions),
    totalApprovals,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS),
  };
}

/**
 * Adds cycle records to the persisted analytics state idempotently.
 *
 * @param state The state to mutate.
 * @param records The newly persisted cycle records.
 * @returns Nothing.
 */
function mergeRecordsIntoAnalyticsState(
  state: ReviewCycleAnalyticsState,
  records: FirestoreReviewCycle[],
): void {
  const submissionKeys = new Set(state.submissionKeys);
  const approvalKeys = new Set(state.approvalKeys);

  for (const data of records) {
    const reviewerPrKey = `${data.reviewerLogin}:${data.prNumber}`;

    if (data.reviewSubmissionCount > 0 && !submissionKeys.has(reviewerPrKey)) {
      submissionKeys.add(reviewerPrKey);
      const weekStart = getIstWeekStartDateKey(new Date(data.completedAt));
      state.weeklyReviews[weekStart] =
        (state.weeklyReviews[weekStart] ?? 0) + data.reviewSubmissionCount;

      const month = getIstDateKey(new Date(data.completedAt)).slice(0, 7);
      const reviewers = new Set(state.monthlyReviewerKeys[month] ?? []);
      reviewers.add(data.reviewerLogin);
      state.monthlyReviewerKeys[month] = Array.from(reviewers);
    }

    if (data.reviewRoundsBeforeApproval !== null) {
      const approvalKey = reviewerPrKey;
      if (!approvalKeys.has(approvalKey)) {
        approvalKeys.add(approvalKey);
      }
    }

    if (data.prAdditions !== null) {
      const existing = state.prStats[String(data.prNumber)] ?? {
        additions: data.prAdditions,
        totalDurationMs: 0,
        count: 0,
      };
      existing.totalDurationMs += data.durationMs;
      existing.count++;
      state.prStats[String(data.prNumber)] = existing;
    }
  }

  state.submissionKeys = Array.from(submissionKeys);
  state.approvalKeys = Array.from(approvalKeys);
}

/**
 * Performs the one-time full analytics bootstrap from review-cycle history.
 *
 * @returns The initialized analytics and merge state.
 */
async function computeReviewCycleAnalytics(): Promise<StoredAnalytics> {
  const snapshot = await collection.get();
  const state = createAnalyticsState();
  mergeRecordsIntoAnalyticsState(
    state,
    snapshot.docs.map((doc) => normalizeReviewCycle(doc.data())),
  );
  return {
    ...buildAnalyticsFromState(state),
    analyticsState: state,
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
export async function getReviewCycleAnalyticsSnapshot(): Promise<StoredAnalytics | null> {
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
  const computed = await computeReviewCycleAnalytics();
  await analyticsDoc.set(serializeReviewCycleAnalytics(computed));
  return computed;
}

/**
 * Merges newly persisted cycles into the analytics snapshot. If no snapshot
 * exists yet, a one-time full bootstrap is performed.
 *
 * @param records Newly persisted cycle records.
 * @returns The updated analytics.
 */
export async function updateReviewCycleAnalytics(
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): Promise<ReviewerTeamsAnalytics> {
  const existing = await getReviewCycleAnalyticsSnapshot();
  if (!existing?.analyticsState) {
    return refreshReviewCycleAnalytics();
  }

  const firestoreRecords = records.map((record) => ({
    ...record,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLES),
  }));
  let updatedAnalytics: ReviewerTeamsAnalytics | null = null;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(analyticsDoc);
    const data = snapshot.data();
    const current = data ? normalizeReviewCycleAnalytics(data) : null;
    const state = current?.analyticsState ?? existing.analyticsState!;
    mergeRecordsIntoAnalyticsState(state, firestoreRecords);
    updatedAnalytics = buildAnalyticsFromState(state);
    transaction.set(
      analyticsDoc,
      serializeReviewCycleAnalytics({
        ...updatedAnalytics,
        analyticsState: state,
      }),
    );
  });

  return updatedAnalytics!;
}

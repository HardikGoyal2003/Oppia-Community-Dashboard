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
import {
  getIstDateKey,
  getIstWeekStartDateKey,
  parseDateValue,
  parseTimestampMs,
} from "@/lib/utils/date.utils";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreReviewCycle,
  normalizeReviewCycle,
  serializeReviewCycle,
} from "./review-cycles.mapper";
import {
  type FirestoreReviewCycleAnalytics,
  normalizeReviewCycleAnalytics,
  serializeReviewCycleAnalytics,
} from "./review-cycle-analytics.mapper";
import {
  getRecentReviewCyclePrStats,
  getReviewCyclePrStats,
  upsertReviewCyclePrStats,
} from "@/db/review-cycle-pr-stats/review-cycle-pr-stats.db";
import {
  type ReviewCyclePrReviewerFact,
  type ReviewCyclePrStatsDocument,
} from "@/db/review-cycle-pr-stats/review-cycle-pr-stats.mapper";
import {
  getReviewCycleMonthlyReviewers,
  upsertReviewCycleMonthlyReviewers,
} from "@/db/review-cycle-monthly-reviewers/review-cycle-monthly-reviewers.db";

/**
 * The subset of a PR stats document needed to build the scatter chart.
 */
type PrScatterSource = {
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
 * Number of most recent PRs kept in the dashboard scatter snapshot.
 *
 * The scatter is a visualization, so it is capped to keep the analytics
 * document bounded. Full per-PR stats stay in `reviewCyclePrStats`.
 */
const PR_SIZE_SCATTER_LIMIT = 400;

/**
 * Firestore caps a single batch at 500 writes, so multi-document writes are
 * committed in chunks with some headroom.
 */
const WRITE_BATCH_SIZE = 400;

/**
 * Batch upserts multiple review cycle records.
 *
 * A 2-month backfill can produce well over the Firestore batch limit.
 *
 * @param records The cycle records to persist.
 * @returns A promise that resolves when all batch writes complete.
 */
export async function upsertReviewCycles(
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): Promise<void> {
  for (let start = 0; start < records.length; start += WRITE_BATCH_SIZE) {
    const batch = collection.firestore.batch();

    for (const record of records.slice(start, start + WRITE_BATCH_SIZE)) {
      const key = `${record.reviewerLogin}:${record.prNumber}:${record.assignedAt}`;
      batch.set(collection.doc(key), serializeReviewCycle(record), {
        merge: true,
      });
    }

    await batch.commit();
  }
}

/**
 * Deletes every stored review cycle belonging to the given reviewer logins.
 *
 * The dummy-data generator uses this to replace its sample reviewers' cycles,
 * so repeated runs do not accumulate duplicates under new document keys.
 *
 * @param logins The reviewer logins whose cycles should be deleted.
 * @returns The number of deleted documents.
 */
export async function deleteReviewCyclesForReviewers(
  logins: string[],
): Promise<number> {
  const uniqueLogins = Array.from(new Set(logins));
  let deleted = 0;

  for (
    let start = 0;
    start < uniqueLogins.length;
    start += AGGREGATE_LOGIN_CHUNK_SIZE
  ) {
    const chunk = uniqueLogins.slice(start, start + AGGREGATE_LOGIN_CHUNK_SIZE);
    const snapshot = await collection.where("reviewerLogin", "in", chunk).get();

    for (
      let offset = 0;
      offset < snapshot.docs.length;
      offset += WRITE_BATCH_SIZE
    ) {
      const batch = collection.firestore.batch();

      for (const doc of snapshot.docs.slice(
        offset,
        offset + WRITE_BATCH_SIZE,
      )) {
        batch.delete(doc.ref);
      }

      await batch.commit();
    }

    deleted += snapshot.size;
  }

  return deleted;
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
 * Creates a zeroed per-reviewer aggregate.
 *
 * @returns An aggregate with every counter reset.
 */
function createEmptyAggregate(): ReviewCycleAggregate {
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
  data: FirestoreReviewCycle,
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
 * Builds a reviewer-PR fact from a cycle record.
 *
 * @param record The cycle record.
 * @returns The reviewer-PR fact.
 */
function buildReviewerFact(
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
function earlierTimestamp(
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
function laterTimestamp(
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
function createPrStatsDocument(
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
 * Assembles the dashboard analytics payload from its bounded inputs.
 *
 * @param weeklyReviews Weekly submission counts keyed by week start.
 * @param monthlyLogins Reviewer logins keyed by month.
 * @param approvalsByReviewer Approval counts keyed by reviewer login.
 * @param prStats PR stats used to build the scatter chart.
 * @returns The analytics payload.
 */
function buildAnalytics(
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
function buildScatter(
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
 * Performs the one-time full analytics bootstrap from review-cycle history.
 *
 * Rebuilds the bounded aggregate documents (`reviewCyclePrStats` and
 * `reviewCycleMonthlyReviewers`) as well as the analytics snapshot, so later
 * incremental updates stay consistent.
 *
 * @returns The rebuilt analytics.
 */
async function rebuildReviewCycleAnalytics(): Promise<ReviewerTeamsAnalytics> {
  const snapshot = await collection.get();

  const prStats = new Map<
    number,
    Omit<ReviewCyclePrStatsDocument, "schemaVersion">
  >();
  const monthlyLogins = new Map<string, Set<string>>();
  const weeklyReviews = new Map<string, number>();
  const approvalsByReviewer = new Map<string, number>();

  snapshot.forEach((doc) => {
    const data = normalizeReviewCycle(doc.data());
    const stats =
      prStats.get(data.prNumber) ?? createPrStatsDocument(data.prNumber);

    if (data.prAdditions !== null) stats.additions = data.prAdditions;

    stats.firstAssignedAt = earlierTimestamp(
      stats.firstAssignedAt,
      data.assignedAt,
    );
    stats.lastApprovedAt = laterTimestamp(
      stats.lastApprovedAt,
      data.approvedAt,
    );

    if (!stats.reviewers[data.reviewerLogin]) {
      const fact = buildReviewerFact(data);
      stats.reviewers[data.reviewerLogin] = fact;

      if (fact.submissions > 0) {
        weeklyReviews.set(
          fact.weekStart,
          (weeklyReviews.get(fact.weekStart) ?? 0) + fact.submissions,
        );
        const logins = monthlyLogins.get(fact.month) ?? new Set<string>();
        logins.add(data.reviewerLogin);
        monthlyLogins.set(fact.month, logins);
      }

      if (fact.approved) {
        approvalsByReviewer.set(
          data.reviewerLogin,
          (approvalsByReviewer.get(data.reviewerLogin) ?? 0) + 1,
        );
      }
    }

    prStats.set(data.prNumber, stats);
  });

  const analytics = buildAnalytics(
    weeklyReviews,
    monthlyLogins,
    approvalsByReviewer,
    prStats.values(),
  );

  await Promise.all([
    upsertReviewCyclePrStats(Array.from(prStats.values())),
    upsertReviewCycleMonthlyReviewers(
      Array.from(monthlyLogins.entries()).map(([month, logins]) => ({
        month,
        logins: Array.from(logins).sort(),
        lastUpdated: new Date(),
      })),
    ),
  ]);
  await analyticsDoc.set(serializeReviewCycleAnalytics(analytics));

  return analytics;
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
 * Recomputes org-wide reviewer analytics and all bounded aggregate documents.
 *
 * @returns The freshly computed analytics.
 */
export async function refreshReviewCycleAnalytics(): Promise<ReviewerTeamsAnalytics> {
  return rebuildReviewCycleAnalytics();
}

/**
 * Applies a batch of cycle records to the bounded aggregate documents.
 *
 * Updates `reviewCyclePrStats` first (which owns reviewer-PR dedupe), then
 * folds only the newly counted facts into the analytics snapshot and monthly
 * membership documents. Also returns the per-reviewer contribution so the
 * caller can update `reviewerCycleAggregates` without re-reading cycles.
 *
 * @param records The newly persisted cycle records.
 * @returns Per-reviewer contributions keyed by login.
 */
export async function applyReviewCycleContributions(
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): Promise<Map<string, ReviewCycleLoginContribution>> {
  const contributions = new Map<string, ReviewCycleLoginContribution>();
  if (records.length === 0) return contributions;

  const byPr = new Map<
    number,
    Array<Omit<ReviewCycleRecord, "schemaVersion">>
  >();
  for (const record of records) {
    const existing = byPr.get(record.prNumber) ?? [];
    existing.push(record);
    byPr.set(record.prNumber, existing);
  }

  const prStats = await getReviewCyclePrStats(Array.from(byPr.keys()));
  const updatedPrStats: Array<
    Omit<ReviewCyclePrStatsDocument, "schemaVersion">
  > = [];

  for (const [prNumber, prRecords] of byPr) {
    const existing = prStats.get(prNumber);
    const stats = existing
      ? { ...existing, reviewers: { ...existing.reviewers } }
      : createPrStatsDocument(prNumber);

    for (const record of prRecords) {
      const contribution = contributions.get(record.reviewerLogin) ?? {
        completedReviews: 0,
        totalReviewTimeMs: 0,
        totalApprovalDurationMs: 0,
        approvalsWithDuration: 0,
        newFacts: [],
      };

      if (record.prAdditions !== null) stats.additions = record.prAdditions;
      stats.firstAssignedAt = earlierTimestamp(
        stats.firstAssignedAt,
        record.assignedAt,
      );
      stats.lastApprovedAt = laterTimestamp(
        stats.lastApprovedAt,
        record.approvedAt,
      );

      contribution.completedReviews++;
      contribution.totalReviewTimeMs += record.durationMs;
      if (record.approvalDurationMs !== null) {
        contribution.totalApprovalDurationMs += record.approvalDurationMs;
        contribution.approvalsWithDuration++;
      }

      if (!stats.reviewers[record.reviewerLogin]) {
        const fact = buildReviewerFact(record);
        stats.reviewers[record.reviewerLogin] = fact;
        contribution.newFacts.push(fact);
      }

      contributions.set(record.reviewerLogin, contribution);
    }

    stats.lastUpdated = new Date();
    updatedPrStats.push(stats);
  }

  await upsertReviewCyclePrStats(updatedPrStats);
  await applyAnalyticsContributions(contributions);

  return contributions;
}

/**
 * Folds newly counted PR facts into the analytics snapshot.
 *
 * Monthly membership is read from its own documents and the scatter is derived
 * from the most recent PR stats, so the snapshot stays bounded. If the stored
 * snapshot predates monthly documents, a full rebuild runs once to rewrite them
 * before incremental updates continue.
 *
 * @param contributions Per-reviewer contributions for this batch.
 * @returns Nothing.
 */
async function applyAnalyticsContributions(
  contributions: Map<string, ReviewCycleLoginContribution>,
): Promise<void> {
  const current = await getReviewCycleAnalyticsSnapshot();

  if (!current) {
    await rebuildReviewCycleAnalytics();
    return;
  }

  const snapshotMonths = current.monthlyUniqueReviewers.map(
    (point) => point.month,
  );
  const affectedMonths = new Set<string>();
  for (const contribution of contributions.values()) {
    for (const fact of contribution.newFacts) {
      if (fact.submissions > 0) affectedMonths.add(fact.month);
    }
  }

  const monthlyDocs = await getReviewCycleMonthlyReviewers(
    Array.from(new Set([...snapshotMonths, ...affectedMonths])),
  );

  // A snapshot from before monthly documents existed cannot be updated
  // incrementally without losing per-month membership.
  if (snapshotMonths.some((month) => !monthlyDocs.has(month))) {
    await rebuildReviewCycleAnalytics();
    return;
  }

  const monthlyLogins = new Map<string, Set<string>>();
  for (const [month, doc] of monthlyDocs) {
    monthlyLogins.set(month, new Set(doc.logins));
  }

  const weeklyReviews = new Map(
    current.weeklyReviews.map((point) => [point.weekStart, point.reviews]),
  );
  const approvalsByReviewer = new Map(
    current.topApprovers.map((approver) => [
      approver.username,
      approver.approvals,
    ]),
  );

  for (const [login, contribution] of contributions) {
    for (const fact of contribution.newFacts) {
      if (fact.submissions > 0) {
        weeklyReviews.set(
          fact.weekStart,
          (weeklyReviews.get(fact.weekStart) ?? 0) + fact.submissions,
        );
        const logins = monthlyLogins.get(fact.month) ?? new Set<string>();
        logins.add(login);
        monthlyLogins.set(fact.month, logins);
      }

      if (fact.approved) {
        approvalsByReviewer.set(
          login,
          (approvalsByReviewer.get(login) ?? 0) + 1,
        );
      }
    }
  }

  const recentPrStats = await getRecentReviewCyclePrStats(
    PR_SIZE_SCATTER_LIMIT,
  );
  const analytics = buildAnalytics(
    weeklyReviews,
    monthlyLogins,
    approvalsByReviewer,
    recentPrStats,
  );

  await Promise.all([
    upsertReviewCycleMonthlyReviewers(
      Array.from(affectedMonths).map((month) => ({
        month,
        logins: Array.from(monthlyLogins.get(month) ?? []).sort(),
        lastUpdated: new Date(),
      })),
    ),
    analyticsDoc.set(serializeReviewCycleAnalytics(analytics)),
  ]);
}

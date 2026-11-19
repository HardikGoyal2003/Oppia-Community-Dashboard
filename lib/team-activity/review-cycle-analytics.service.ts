import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type {
  ReviewerTeamsAnalytics,
  ReviewCycleRecord,
} from "@/lib/domain/reviewer-teams.types";
import {
  getAllReviewCycles,
  getReviewCycleAnalyticsSnapshot,
  getReviewCyclesByReviewerLogins,
  saveReviewCycleAnalyticsSnapshot,
} from "@/db/review-cycles/review-cycles.db";
import {
  getRecentReviewCyclePrStats,
  getReviewCyclePrStats,
  upsertReviewCyclePrStats,
} from "@/db/review-cycle-pr-stats/review-cycle-pr-stats.db";
import type { ReviewCyclePrStatsDocument } from "@/db/review-cycle-pr-stats/review-cycle-pr-stats.mapper";
import {
  getReviewCycleMonthlyReviewers,
  upsertReviewCycleMonthlyReviewers,
} from "@/db/review-cycle-monthly-reviewers/review-cycle-monthly-reviewers.db";
import {
  aggregateCycleRecords,
  buildAnalytics,
  buildReviewerFact,
  createPrStatsDocument,
  earlierTimestamp,
  laterTimestamp,
  PR_SIZE_SCATTER_LIMIT,
  type ReviewCycleAggregate,
  type ReviewCycleLoginContribution,
} from "@/lib/reviewer-teams/review-cycle-calculations";

/**
 * Computes aggregate stats for the given reviewers only.
 *
 * Reads just the cycles belonging to those logins instead of the whole
 * collection, so a daily sync does not scan historical cycles for reviewers
 * it will not update.
 *
 * @param platform The repository platform the cycles belong to.
 * @param logins The reviewer logins to aggregate.
 * @returns A map of login to aggregate stats.
 */
export async function getReviewCycleAggregatesForLogins(
  platform: ContributionPlatform,
  logins: string[],
): Promise<Map<string, ReviewCycleAggregate>> {
  const records = await getReviewCyclesByReviewerLogins(platform, logins);
  if (records.length === 0) return new Map();
  return aggregateCycleRecords(records);
}

/**
 * Performs a full analytics rebuild from review-cycle history.
 *
 * Rebuilds the bounded aggregate documents (`reviewCyclePrStats` and
 * `reviewCycleMonthlyReviewers`) as well as the analytics snapshot, so later
 * incremental updates stay consistent.
 *
 * @param platform The repository platform to rebuild.
 * @returns The rebuilt analytics.
 */
async function rebuildReviewCycleAnalytics(
  platform: ContributionPlatform,
): Promise<Omit<ReviewerTeamsAnalytics, "schemaVersion">> {
  const records = await getAllReviewCycles(platform);

  const prStats = new Map<
    number,
    Omit<ReviewCyclePrStatsDocument, "schemaVersion">
  >();
  const monthlyLogins = new Map<string, Set<string>>();
  const weeklyReviews = new Map<string, number>();
  const approvalsByReviewer = new Map<string, number>();

  for (const data of records) {
    const stats =
      prStats.get(data.prNumber) ??
      createPrStatsDocument(platform, data.prNumber);

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
  }

  const analytics = buildAnalytics(
    platform,
    weeklyReviews,
    monthlyLogins,
    approvalsByReviewer,
    prStats.values(),
  );

  await Promise.all([
    upsertReviewCyclePrStats(platform, Array.from(prStats.values())),
    upsertReviewCycleMonthlyReviewers(
      platform,
      Array.from(monthlyLogins.entries()).map(([month, logins]) => ({
        platform,
        month,
        logins: Array.from(logins).sort(),
        lastUpdated: new Date(),
      })),
    ),
  ]);
  await saveReviewCycleAnalyticsSnapshot(platform, analytics);

  return analytics;
}

/**
 * Recomputes org-wide reviewer analytics and all bounded aggregate documents.
 *
 * @param platform The repository platform to rebuild.
 * @returns The freshly computed analytics.
 */
export async function refreshReviewCycleAnalytics(
  platform: ContributionPlatform,
): Promise<Omit<ReviewerTeamsAnalytics, "schemaVersion">> {
  return rebuildReviewCycleAnalytics(platform);
}

/**
 * Folds newly counted PR facts into the analytics snapshot.
 *
 * Monthly membership is read from its own documents and the scatter is derived
 * from the most recent PR stats, so the snapshot stays bounded. If the stored
 * snapshot predates monthly documents, a full rebuild runs once to rewrite them
 * before incremental updates continue.
 *
 * @param platform The repository platform the contributions belong to.
 * @param contributions Per-reviewer contributions for this batch.
 * @returns Nothing.
 */
async function applyAnalyticsContributions(
  platform: ContributionPlatform,
  contributions: Map<string, ReviewCycleLoginContribution>,
): Promise<void> {
  const current = await getReviewCycleAnalyticsSnapshot(platform);

  if (!current) {
    await rebuildReviewCycleAnalytics(platform);
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
    platform,
    Array.from(new Set([...snapshotMonths, ...affectedMonths])),
  );

  // A snapshot from before monthly documents existed cannot be updated
  // incrementally without losing per-month membership.
  if (snapshotMonths.some((month) => !monthlyDocs.has(month))) {
    await rebuildReviewCycleAnalytics(platform);
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
    platform,
    PR_SIZE_SCATTER_LIMIT,
  );
  const analytics = buildAnalytics(
    platform,
    weeklyReviews,
    monthlyLogins,
    approvalsByReviewer,
    recentPrStats,
  );

  await Promise.all([
    upsertReviewCycleMonthlyReviewers(
      platform,
      Array.from(affectedMonths).map((month) => ({
        platform,
        month,
        logins: Array.from(monthlyLogins.get(month) ?? []).sort(),
        lastUpdated: new Date(),
      })),
    ),
    saveReviewCycleAnalyticsSnapshot(platform, analytics),
  ]);
}

/**
 * Applies a batch of cycle records to the bounded aggregate documents.
 *
 * Updates `reviewCyclePrStats` first (which owns reviewer-PR dedupe), then
 * folds only the newly counted facts into the analytics snapshot and monthly
 * membership documents. Also returns the per-reviewer contribution so the
 * caller can update `reviewerCycleAggregates` without re-reading cycles.
 *
 * @param platform The repository platform the cycles belong to.
 * @param records The newly persisted cycle records.
 * @returns Per-reviewer contributions keyed by login.
 */
export async function applyReviewCycleContributions(
  platform: ContributionPlatform,
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

  const prStats = await getReviewCyclePrStats(
    platform,
    Array.from(byPr.keys()),
  );
  const updatedPrStats: Array<
    Omit<ReviewCyclePrStatsDocument, "schemaVersion">
  > = [];

  for (const [prNumber, prRecords] of byPr) {
    const existing = prStats.get(prNumber);
    const stats = existing
      ? { ...existing, reviewers: { ...existing.reviewers } }
      : createPrStatsDocument(platform, prNumber);

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

  await upsertReviewCyclePrStats(platform, updatedPrStats);
  await applyAnalyticsContributions(platform, contributions);

  return contributions;
}

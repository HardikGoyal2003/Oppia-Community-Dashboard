import {
  fetchCycleRecords,
  fetchClosedPRCycleRecords,
} from "@/lib/github/github.fetcher";
import {
  getAllReviewerLogins,
  getReviewer,
  upsertReviewer,
} from "@/db/reviewers/reviewers.db";
import {
  upsertReviewCycles,
  findNewCycleRecords,
} from "@/db/review-cycles/review-cycles.db";

type SyncSummary = {
  completedCyclesCount: number;
  newCyclesCount: number;
  updatedReviewersCount: number;
};

/** Number of days of closed PR history to process each run. */
const CLOSED_PR_LOOKBACK_DAYS = 3;

/**
 * Syncs completed review cycles from GitHub into Firestore.
 *
 * Processes all open PRs + PRs closed within the last
 * `CLOSED_PR_LOOKBACK_DAYS` days, extracts completed cycles from their
 * timelines, and writes:
 * - `reviewCycles/{key}` — completed cycles (idempotent merge)
 * - `reviewers/{login}` — incrementally updates `completedReviews` and
 *   `avgReviewTimeHours` only for cycles that are newly persisted.
 *
 * Only processes cycles for reviewers who already have a doc in the
 * `reviewers` collection.
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewCycles(): Promise<SyncSummary> {
  const sinceDate = new Date(
    Date.now() - CLOSED_PR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const [openResult, closedCompleted, reviewerLogins] = await Promise.all([
    fetchCycleRecords(),
    fetchClosedPRCycleRecords(sinceDate),
    getAllReviewerLogins(),
  ]);

  const allCompleted = [...openResult.completed, ...closedCompleted];

  const filtered = allCompleted.filter((c) =>
    reviewerLogins.has(c.reviewerLogin),
  );

  const newRecords = await findNewCycleRecords(filtered);

  await upsertReviewCycles(filtered);

  const newAggs = new Map<string, { count: number; totalMs: number }>();
  for (const record of newRecords) {
    const agg = newAggs.get(record.reviewerLogin) ?? {
      count: 0,
      totalMs: 0,
    };
    agg.count++;
    agg.totalMs += record.durationMs;
    newAggs.set(record.reviewerLogin, agg);
  }

  let updatedCount = 0;

  for (const [login, batch] of newAggs) {
    const existing = await getReviewer(login);
    const oldCount = existing?.completedReviews ?? 0;
    const newCount = oldCount + batch.count;
    const oldTotalHours = (existing?.avgReviewTimeHours ?? 0) * oldCount;
    const newTotalHours = batch.totalMs / 3_600_000;
    const avgReviewTimeHours =
      newCount > 0
        ? Number(((oldTotalHours + newTotalHours) / newCount).toFixed(1))
        : null;

    await upsertReviewer(login, {
      teams: existing?.teams ?? [],
      pendingReviews: existing?.pendingReviews ?? [],
      completedReviews: newCount,
      avgReviewTimeHours,
      lastUpdated: new Date(),
    });

    updatedCount++;
  }

  return {
    completedCyclesCount: allCompleted.length,
    newCyclesCount: newRecords.length,
    updatedReviewersCount: updatedCount,
  };
}

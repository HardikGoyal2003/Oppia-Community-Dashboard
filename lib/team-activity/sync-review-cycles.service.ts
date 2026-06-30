import { fetchCycleRecords } from "@/lib/github/github.fetcher";
import { getReviewer, upsertReviewer } from "@/db/reviewers/reviewers.db";
import { upsertReviewCycles } from "@/db/review-cycles/review-cycles.db";

type SyncSummary = {
  completedCyclesCount: number;
  updatedReviewersCount: number;
};

/**
 * Syncs completed review cycles from GitHub into Firestore.
 *
 * Fetches cycle records from open PRs and writes:
 * - `reviewCycles/{key}` — completed review cycles (idempotent)
 * - `reviewers/{login}` — updates `completedReviews` and
 *   `avgReviewTimeHours`, preserving existing `pendingReviews` and `teams`.
 *
 * Does NOT update pending reviews — that is handled by the separate
 * `sync-pending-reviews` cron job.
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewCycles(): Promise<SyncSummary> {
  const { completed } = await fetchCycleRecords();

  await upsertReviewCycles(completed);

  const cycleAggs = new Map<string, { count: number; totalMs: number }>();
  for (const record of completed) {
    const agg = cycleAggs.get(record.reviewerLogin) ?? {
      count: 0,
      totalMs: 0,
    };
    agg.count++;
    agg.totalMs += record.durationMs;
    cycleAggs.set(record.reviewerLogin, agg);
  }

  const reviewerLogins = new Set<string>();
  for (const record of completed) {
    reviewerLogins.add(record.reviewerLogin);
  }

  for (const login of reviewerLogins) {
    const existing = await getReviewer(login);
    const agg = cycleAggs.get(login);

    await upsertReviewer(login, {
      teams: existing?.teams ?? [],
      pendingReviews: existing?.pendingReviews ?? [],
      completedReviews: agg?.count ?? 0,
      avgReviewTimeHours:
        agg && agg.count > 0
          ? Number((agg.totalMs / agg.count / 3_600_000).toFixed(1))
          : null,
      lastUpdated: new Date(),
    });
  }

  return {
    completedCyclesCount: completed.length,
    updatedReviewersCount: reviewerLogins.size,
  };
}

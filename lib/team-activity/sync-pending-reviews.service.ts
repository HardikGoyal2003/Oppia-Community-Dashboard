import { fetchAssignedPRs } from "@/lib/github/github.fetcher";
import { getReviewer, upsertReviewer } from "@/db/reviewers/reviewers.db";

type SyncSummary = {
  pendingReviewsCount: number;
  updatedReviewersCount: number;
};

/**
 * Syncs pending reviews from GitHub into `reviewers/{login}.pendingReviews`.
 *
 * Fetches open PR assignments via `fetchAssignedPRs` and updates only the
 * `pendingReviews` field on each reviewer doc, preserving existing
 * `teams`, `completedReviews`, and `avgReviewTimeHours`.
 *
 * Runs daily.
 *
 * @returns A summary of the sync operation.
 */
export async function syncPendingReviews(): Promise<SyncSummary> {
  const memberPRs = await fetchAssignedPRs();

  let totalPending = 0;
  let updatedCount = 0;

  for (const [login, prs] of memberPRs) {
    const existing = await getReviewer(login);

    const pendingReviews = prs.map((pr) => ({
      prNumber: pr.prNumber,
      title: pr.title,
      url: pr.url,
      assignedAt: pr.assignedAt,
    }));

    await upsertReviewer(login, {
      teams: existing?.teams ?? [],
      pendingReviews,
      completedReviews: existing?.completedReviews ?? 0,
      avgReviewTimeHours: existing?.avgReviewTimeHours ?? null,
      lastUpdated: new Date(),
    });

    totalPending += pendingReviews.length;
    updatedCount++;
  }

  return {
    pendingReviewsCount: totalPending,
    updatedReviewersCount: updatedCount,
  };
}

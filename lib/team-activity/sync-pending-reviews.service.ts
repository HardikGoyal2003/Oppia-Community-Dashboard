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
      ...(existing ?? {
        teams: [],
        completedReviews: 0,
        reviewedPrCount: 0,
        completedReviewSubmissions: 0,
        approvedPrCount: 0,
        authoredPrCount: 0,
        avgReviewTimeHours: null,
        avgTimeToApprovalHours: null,
        avgReviewRoundsBeforeApproval: null,
        avgCommentsPerReview: null,
        avgReviewsPerWeek: null,
      }),
      pendingReviews,
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

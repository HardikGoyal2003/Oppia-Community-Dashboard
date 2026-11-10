import { fetchAssignedPRs } from "@/lib/github/github.fetcher";
import { getReviewers, upsertReviewers } from "@/db/reviewers/reviewers.db";
import { getReviewerTeamLogins } from "@/lib/team-activity/reviewer-team-logins";
import type {
  PendingReview,
  ReviewerDocument,
} from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  pendingReviewsCount: number;
  updatedReviewersCount: number;
};

/**
 * Default reviewer document used when a team member has open assignments but
 * no stored reviewer document yet. Metrics are filled in by the cycle sync.
 */
const EMPTY_REVIEWER: Omit<ReviewerDocument, "schemaVersion"> = {
  teams: [],
  pendingReviews: [],
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
  lastUpdated: new Date(0),
};

/**
 * Checks whether two pending-review lists hold the same assignments.
 *
 * @param left The stored pending reviews.
 * @param right The freshly fetched pending reviews.
 * @returns Whether both lists describe the same assignments.
 */
function pendingReviewsEqual(
  left: PendingReview[],
  right: PendingReview[],
): boolean {
  if (left.length !== right.length) return false;

  return left.every((entry, index) => {
    const other = right[index];
    return (
      entry.prNumber === other.prNumber &&
      entry.title === other.title &&
      entry.url === other.url &&
      entry.assignedAt === other.assignedAt
    );
  });
}

/**
 * Syncs pending reviews from GitHub into `reviewers/{login}.pendingReviews`.
 *
 * Fetches open PR assignments via `fetchAssignedPRs`, ignores assignees who
 * are not current reviewer-team members, and updates only the
 * `pendingReviews` field on each reviewer doc, preserving existing
 * `teams`, `completedReviews`, and `avgReviewTimeHours`.
 *
 * Every current team member is considered, not just the logins GitHub
 * returned: members with no open assignments have their stored
 * `pendingReviews` replaced with an empty list so stale entries never
 * linger. Writes are batched and skipped when nothing changed.
 *
 * Runs daily.
 *
 * @returns A summary of the sync operation.
 */
export async function syncPendingReviews(): Promise<SyncSummary> {
  const teamLogins = await getReviewerTeamLogins();

  if (teamLogins.size === 0) {
    console.warn(
      "[syncPendingReviews] No reviewer teams found; run Sync Reviewer Teams first. Skipping.",
    );
    return { pendingReviewsCount: 0, updatedReviewersCount: 0 };
  }

  const [memberPRs, reviewerDocs] = await Promise.all([
    fetchAssignedPRs(),
    getReviewers(Array.from(teamLogins)),
  ]);

  const updates: Array<{
    login: string;
    doc: Omit<ReviewerDocument, "schemaVersion">;
  }> = [];
  let totalPending = 0;

  for (const login of teamLogins) {
    const pendingReviews = (memberPRs.get(login) ?? []).map((pr) => ({
      prNumber: pr.prNumber,
      title: pr.title,
      url: pr.url,
      assignedAt: pr.assignedAt,
    }));

    totalPending += pendingReviews.length;

    const existing = reviewerDocs.get(login);

    // Do not create a reviewer document for a member with no assignments.
    if (!existing && pendingReviews.length === 0) continue;

    if (
      existing &&
      pendingReviewsEqual(existing.pendingReviews, pendingReviews)
    ) {
      continue;
    }

    updates.push({
      login,
      doc: {
        ...(existing ?? EMPTY_REVIEWER),
        pendingReviews,
        lastUpdated: new Date(),
      },
    });
  }

  await upsertReviewers(updates);

  return {
    pendingReviewsCount: totalPending,
    updatedReviewersCount: updates.length,
  };
}

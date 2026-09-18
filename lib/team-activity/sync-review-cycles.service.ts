import {
  fetchCycleRecords,
  fetchClosedPRCycleRecords,
} from "@/lib/github/github.fetcher";
import { getReviewer, upsertReviewer } from "@/db/reviewers/reviewers.db";
import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  upsertReviewCycles,
  findNewCycleRecords,
  getAllReviewCycleAggregates,
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
 * - `reviewers/{login}` — recomputes all stats from every stored cycle
 *   record so averages stay consistent even when no new cycles appear.
 *
 * Only processes cycles for reviewers who already have a doc in the
 * `reviewers` collection.
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewCycles(): Promise<SyncSummary> {
  const platform: ContributionPlatform = "WEB";
  const sinceDate = new Date(
    Date.now() - CLOSED_PR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const [openResult, closedResult, teamDoc] = await Promise.all([
    fetchCycleRecords(),
    fetchClosedPRCycleRecords(sinceDate),
    getTeamReviewers(platform),
  ]);

  const knownLogins = new Set<string>();
  if (teamDoc) {
    for (const team of teamDoc.teams) {
      for (const member of team.members) {
        knownLogins.add(member.username);
      }
    }
  }

  const allCompleted = [...openResult.completed, ...closedResult.completed];

  const filtered = allCompleted.filter((c) => knownLogins.has(c.reviewerLogin));

  const newRecords = await findNewCycleRecords(filtered);

  await upsertReviewCycles(filtered);

  const aggregates = await getAllReviewCycleAggregates();

  let updatedCount = 0;

  for (const [login, agg] of aggregates) {
    if (!knownLogins.has(login)) continue;

    const existing = await getReviewer(login);

    const avgReviewTimeHours =
      agg.completedReviews > 0
        ? Number(
            (agg.totalReviewTimeMs / agg.completedReviews / 3_600_000).toFixed(
              1,
            ),
          )
        : null;

    const avgReviewRoundsBeforeApproval =
      agg.approvedPrCount > 0
        ? Number(
            (agg.totalRoundsBeforeApproval / agg.approvedPrCount).toFixed(1),
          )
        : null;

    const avgCommentsPerReview =
      agg.completedReviews > 0
        ? Number((agg.totalComments / agg.completedReviews).toFixed(1))
        : null;

    await upsertReviewer(login, {
      teams: existing?.teams ?? [],
      pendingReviews: existing?.pendingReviews ?? [],
      completedReviews: agg.completedReviews,
      approvedPrCount: agg.approvedPrCount,
      avgReviewTimeHours,
      avgReviewRoundsBeforeApproval,
      avgCommentsPerReview,
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

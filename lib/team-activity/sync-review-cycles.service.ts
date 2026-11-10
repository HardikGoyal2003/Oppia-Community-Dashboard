import {
  fetchCycleRecords,
  fetchClosedPRCycleRecords,
  fetchAuthoredPrCounts,
} from "@/lib/github/github.fetcher";
import { getAllReviewers, upsertReviewer } from "@/db/reviewers/reviewers.db";
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

type SyncReviewCyclesOptions = {
  /** Start of the window to scan. Defaults to the last 24 hours. */
  sinceDate?: Date;
  /** Optional inclusive end of the window, used by the backfill. */
  untilDate?: Date;
};

/**
 * Returns the GitHub logins that currently belong to a reviewer team.
 *
 * @returns The set of known reviewer logins.
 */
async function getKnownReviewerLogins(): Promise<Set<string>> {
  const platform: ContributionPlatform = "WEB";
  const teamDoc = await getTeamReviewers(platform);
  const knownLogins = new Set<string>();

  if (!teamDoc) return knownLogins;

  for (const team of teamDoc.teams) {
    for (const member of team.members) {
      knownLogins.add(member.username);
    }
  }

  return knownLogins;
}

/**
 * Recomputes every known reviewer's stored metrics from the full set of
 * review cycle records.
 *
 * @returns The number of reviewer documents refreshed.
 */
export async function refreshReviewerStats(): Promise<number> {
  const knownLogins = await getKnownReviewerLogins();
  if (knownLogins.size === 0) return 0;

  const [aggregates, reviewerDocs, authoredCounts] = await Promise.all([
    getAllReviewCycleAggregates(),
    getAllReviewers(),
    fetchAuthoredPrCounts(Array.from(knownLogins)),
  ]);

  let updatedCount = 0;

  for (const login of knownLogins) {
    const agg = aggregates.get(login);
    const existing = reviewerDocs.get(login) ?? null;

    const avgReviewTimeHours = !agg
      ? (existing?.avgReviewTimeHours ?? null)
      : agg.completedReviews > 0
        ? Number(
            (agg.totalReviewTimeMs / agg.completedReviews / 3_600_000).toFixed(
              1,
            ),
          )
        : null;

    const avgReviewRoundsBeforeApproval = !agg
      ? (existing?.avgReviewRoundsBeforeApproval ?? null)
      : agg.approvedPrCount > 0
        ? Number(
            (agg.totalRoundsBeforeApproval / agg.approvedPrCount).toFixed(1),
          )
        : null;

    const avgCommentsPerReview = !agg
      ? (existing?.avgCommentsPerReview ?? null)
      : agg.completedReviews > 0
        ? Number((agg.totalComments / agg.completedReviews).toFixed(1))
        : null;

    const avgTimeToApprovalHours = !agg
      ? (existing?.avgTimeToApprovalHours ?? null)
      : agg.approvalsWithDuration > 0
        ? Number(
            (
              agg.totalApprovalDurationMs /
              agg.approvalsWithDuration /
              3_600_000
            ).toFixed(1),
          )
        : null;

    const avgReviewsPerWeek = !agg
      ? (existing?.avgReviewsPerWeek ?? null)
      : agg.activeWeeks.size > 0
        ? Number(
            (agg.completedReviewSubmissions / agg.activeWeeks.size).toFixed(2),
          )
        : null;

    await upsertReviewer(login, {
      teams: existing?.teams ?? [],
      pendingReviews: existing?.pendingReviews ?? [],
      completedReviews:
        agg?.completedReviews ?? existing?.completedReviews ?? 0,
      reviewedPrCount: agg?.reviewedPrs.size ?? existing?.reviewedPrCount ?? 0,
      completedReviewSubmissions:
        agg?.completedReviewSubmissions ??
        existing?.completedReviewSubmissions ??
        0,
      approvedPrCount: agg?.approvedPrCount ?? existing?.approvedPrCount ?? 0,
      authoredPrCount:
        authoredCounts.get(login) ?? existing?.authoredPrCount ?? 0,
      avgReviewTimeHours,
      avgTimeToApprovalHours,
      avgReviewRoundsBeforeApproval,
      avgCommentsPerReview,
      avgReviewsPerWeek,
      lastUpdated: new Date(),
    });

    updatedCount++;
  }

  return updatedCount;
}

/**
 * Syncs completed review cycles from GitHub into Firestore.
 *
 * Processes open PRs updated in the sync window + PRs closed within the
 * window, extracts completed cycles from their timelines, and writes:
 * - `reviewCycles/{key}` — completed cycles (idempotent merge)
 * - `reviewers/{login}` — recomputes all stats from every stored cycle
 *   record so averages stay consistent even when no new cycles appear.
 *
 * Only processes cycles for reviewers who already have a doc in the
 * `reviewers` collection.
 *
 * @param options Optional sync settings.
 * @returns A summary of the sync operation.
 */
export async function syncReviewCycles(
  options?: SyncReviewCyclesOptions,
): Promise<SyncSummary> {
  const sinceDate =
    options?.sinceDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [openResult, closedResult, knownLogins] = await Promise.all([
    fetchCycleRecords(sinceDate, options?.untilDate),
    fetchClosedPRCycleRecords(sinceDate, options?.untilDate),
    getKnownReviewerLogins(),
  ]);

  const allCompleted = [...openResult.completed, ...closedResult.completed];

  const filtered = allCompleted.filter((c) => knownLogins.has(c.reviewerLogin));

  const newRecords = await findNewCycleRecords(filtered);

  await upsertReviewCycles(filtered);

  const updatedReviewersCount = await refreshReviewerStats();

  return {
    completedCyclesCount: allCompleted.length,
    newCyclesCount: newRecords.length,
    updatedReviewersCount,
  };
}

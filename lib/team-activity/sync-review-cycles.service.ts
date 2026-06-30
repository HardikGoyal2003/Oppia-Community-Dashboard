import { fetchCycleRecords } from "@/lib/github/github.fetcher";
import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { upsertReviewer } from "@/db/reviewers/reviewers.db";
import { upsertReviewCycles } from "@/db/review-cycles/review-cycles.db";
import type { ReviewerDocument } from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  completedCyclesCount: number;
  updatedReviewersCount: number;
};

/**
 * Syncs review cycles and reviewer data from GitHub into Firestore.
 *
 * Reads team memberships from the existing `teamReviewers/{platform}` doc,
 * fetches cycle records from open PRs, and writes them to:
 * - `reviewCycles/{key}` — completed review cycles (idempotent)
 * - `reviewers/{login}` — per-reviewer teams + pending reviews + aggregates
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewCycles(): Promise<SyncSummary> {
  const platform = "WEB";

  const teamDoc = await getTeamReviewers(platform);
  const memberToTeams = new Map<string, string[]>();

  if (teamDoc) {
    for (const team of teamDoc.teams) {
      for (const member of team.members) {
        const existing = memberToTeams.get(member.username) ?? [];
        existing.push(team.teamSlug);
        memberToTeams.set(member.username, existing);
      }
    }
  }

  const { completed, pending } = await fetchCycleRecords();

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
  for (const p of pending) {
    reviewerLogins.add(p.reviewerLogin);
  }

  for (const login of reviewerLogins) {
    const pendingReviews = pending
      .filter((p) => p.reviewerLogin === login)
      .map((p) => ({
        prNumber: p.prNumber,
        title: p.prTitle,
        url: p.prUrl,
        assignedAt: p.assignedAt,
      }));

    const agg = cycleAggs.get(login);

    const doc: ReviewerDocument = {
      teams: memberToTeams.get(login) ?? [],
      pendingReviews,
      completedReviews: agg?.count ?? 0,
      avgReviewTimeHours:
        agg && agg.count > 0
          ? Number((agg.totalMs / agg.count / 3_600_000).toFixed(1))
          : null,
      lastUpdated: new Date(),
    };

    await upsertReviewer(login, doc);
  }

  return {
    completedCyclesCount: completed.length,
    updatedReviewersCount: reviewerLogins.size,
  };
}

import {
  fetchWebReviewerTeams,
  fetchTeamAssignedPRs,
  fetchCycleRecords,
} from "@/lib/github/github.fetcher";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { upsertTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { upsertReviewer } from "@/db/reviewers/reviewers.db";
import { upsertReviewCycles } from "@/db/review-cycles/review-cycles.db";
import type {
  TeamReviewersDocument,
  ReviewerDocument,
} from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  platform: string;
  syncedTeamsCount: number;
  totalMembersCount: number;
};

/**
 * Syncs reviewer teams, reviewers, and review cycles from GitHub into
 * Firestore.
 *
 * Fetches web reviewer teams, extracts cycle records from open PRs, and
 * writes to three collections:
 * - `teamReviewers/{platform}` — team info + member lists + team PRs
 * - `reviewers/{login}` — per-reviewer teams + pending reviews
 * - `reviewCycles/{key}` — completed review cycles (idempotent)
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewerTeams(): Promise<SyncSummary> {
  const platform: ContributionPlatform = "WEB";

  const fetchedTeams = await fetchWebReviewerTeams();

  const trackedSlugs = fetchedTeams.map((t) => t.teamSlug);

  const [teamPRs, { completed, pending }] = await Promise.all([
    fetchTeamAssignedPRs(trackedSlugs),
    fetchCycleRecords(),
  ]);

  const teamDoc: TeamReviewersDocument = {
    teams: fetchedTeams.map((team) => ({
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      description: team.description,
      members: team.members.map((m) => ({
        username: m.username,
        avatarUrl: m.avatarUrl,
      })),
      teamAssignedPRs: teamPRs.get(team.teamSlug) ?? [],
    })),
    lastUpdated: new Date(),
  };

  await upsertTeamReviewers(platform, teamDoc);

  const memberToTeams = new Map<string, string[]>();
  for (const team of fetchedTeams) {
    for (const member of team.members) {
      const existing = memberToTeams.get(member.username) ?? [];
      existing.push(team.teamSlug);
      memberToTeams.set(member.username, existing);
    }
  }

  const reviewerLogins = new Set<string>();
  for (const record of completed) {
    reviewerLogins.add(record.reviewerLogin);
  }
  for (const p of pending) {
    reviewerLogins.add(p.reviewerLogin);
  }

  await upsertReviewCycles(completed);

  for (const login of reviewerLogins) {
    const pendingReviews = pending
      .filter((p) => p.reviewerLogin === login)
      .map((p) => ({
        prNumber: p.prNumber,
        title: p.prTitle,
        url: p.prUrl,
        assignedAt: p.assignedAt,
      }));

    const doc: ReviewerDocument = {
      teams: memberToTeams.get(login) ?? [],
      pendingReviews,
      lastUpdated: new Date(),
    };

    await upsertReviewer(login, doc);
  }

  const totalMembersCount = fetchedTeams.reduce(
    (sum, team) => sum + team.members.length,
    0,
  );

  return {
    platform,
    syncedTeamsCount: fetchedTeams.length,
    totalMembersCount,
  };
}

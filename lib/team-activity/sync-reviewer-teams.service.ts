import {
  fetchWebReviewerTeams,
  fetchAssignedPRs,
  fetchTeamAssignedPRs,
  fetchReviewerStats,
} from "@/lib/github/github.fetcher";
import { upsertReviewerTeamsDocument } from "@/db/reviewer-teams/reviewer-teams.db";
import type { ReviewerTeamsDocument } from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  platform: string;
  syncedTeamsCount: number;
  totalMembersCount: number;
};

/**
 * Syncs reviewer teams and their PR assignments from GitHub into Firestore.
 *
 * Fetches web reviewer teams, then fetches both individual and team-level
 * PR assignments, and upserts the combined document.
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewerTeams(): Promise<SyncSummary> {
  const fetchedTeams = await fetchWebReviewerTeams();

  const trackedSlugs = fetchedTeams.map((t) => t.teamSlug);
  const [memberPRs, teamPRs, reviewerStats] = await Promise.all([
    fetchAssignedPRs(),
    fetchTeamAssignedPRs(trackedSlugs),
    fetchReviewerStats(),
  ]);

  const totalMembersCount = fetchedTeams.reduce(
    (sum, team) => sum + team.members.length,
    0,
  );

  const document: ReviewerTeamsDocument = {
    platform: "WEB",
    lastSyncedAt: new Date(),
    teams: fetchedTeams.map((team) => ({
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      description: team.description,
      assignedPRs: teamPRs.get(team.teamSlug) ?? [],
      members: team.members.map((member) => {
        const stats = reviewerStats.get(member.username);
        return {
          username: member.username,
          avatarUrl: member.avatarUrl,
          assignedPRs: memberPRs.get(member.username) ?? [],
          reviewsDone: stats?.reviewsDone ?? 0,
          avgReviewTimeHours:
            stats && stats.reviewsDone > 0
              ? Number(
                  (
                    stats.totalReviewTimeMs /
                    stats.reviewsDone /
                    3_600_000
                  ).toFixed(1),
                )
              : null,
        };
      }),
    })),
  };

  await upsertReviewerTeamsDocument(document);

  return {
    platform: "WEB",
    syncedTeamsCount: fetchedTeams.length,
    totalMembersCount,
  };
}

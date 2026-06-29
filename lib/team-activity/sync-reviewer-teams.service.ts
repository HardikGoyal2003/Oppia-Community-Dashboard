import { fetchWebReviewerTeams } from "@/lib/github/github-teams.fetcher";
import { upsertReviewerTeamsDocument } from "@/db/reviewer-teams/reviewer-teams.db";
import type { ReviewerTeamsDocument } from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  platform: string;
  syncedTeamsCount: number;
  totalMembersCount: number;
};

export async function syncReviewerTeams(): Promise<SyncSummary> {
  const fetchedTeams = await fetchWebReviewerTeams();

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
      members: team.members.map((member) => ({
        username: member.username,
        avatarUrl: member.avatarUrl,
      })),
    })),
  };

  await upsertReviewerTeamsDocument(document);

  return {
    platform: "WEB",
    syncedTeamsCount: fetchedTeams.length,
    totalMembersCount,
  };
}

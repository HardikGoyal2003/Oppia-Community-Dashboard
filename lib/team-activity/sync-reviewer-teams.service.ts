import { fetchWebReviewerTeams } from "@/lib/github/github.fetcher";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { upsertTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import type { TeamReviewersDocument } from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  platform: string;
  syncedTeamsCount: number;
  totalMembersCount: number;
};

/**
 * Syncs reviewer teams from GitHub into Firestore.
 *
 * Fetches web reviewer teams and writes to `teamReviewers/{platform}`.
 * Does not fetch any PR or cycle data — that is handled by the separate
 * `sync-review-cycles` cron job.
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewerTeams(): Promise<SyncSummary> {
  const platform: ContributionPlatform = "WEB";

  const fetchedTeams = await fetchWebReviewerTeams();

  const teamDoc: TeamReviewersDocument = {
    teams: fetchedTeams.map((team) => ({
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      description: team.description,
      members: team.members.map((m) => ({
        username: m.username,
        avatarUrl: m.avatarUrl,
      })),
    })),
    lastUpdated: new Date(),
  };

  await upsertTeamReviewers(platform, teamDoc);

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

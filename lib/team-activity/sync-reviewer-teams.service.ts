import { fetchWebReviewerTeams } from "@/lib/github/github.fetcher";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { upsertTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { getReviewer, upsertReviewer } from "@/db/reviewers/reviewers.db";
import type {
  TeamReviewersDocument,
  ReviewerDocument,
} from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  platform: string;
  syncedTeamsCount: number;
  totalMembersCount: number;
  initialDocsCreated: number;
};

/**
 * Syncs reviewer teams from GitHub into Firestore.
 *
 * Fetches web reviewer teams and writes to `teamReviewers/{platform}`.
 * Also bootstraps initial reviewer documents for any team members that
 * do not yet have one in the `reviewers` collection.
 *
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

  const memberToTeams = new Map<string, string[]>();
  for (const team of fetchedTeams) {
    for (const member of team.members) {
      const existing = memberToTeams.get(member.username) ?? [];
      existing.push(team.teamSlug);
      memberToTeams.set(member.username, existing);
    }
  }

  let initialDocsCreated = 0;

  for (const [login, teams] of memberToTeams) {
    const existing = await getReviewer(login);
    if (existing) continue;

    const doc: ReviewerDocument = {
      teams,
      pendingReviews: [],
      completedReviews: 0,
      avgReviewTimeHours: null,
      lastUpdated: new Date(),
    };

    await upsertReviewer(login, doc);
    initialDocsCreated++;
  }

  const totalMembersCount = fetchedTeams.reduce(
    (sum, team) => sum + team.members.length,
    0,
  );

  return {
    platform,
    syncedTeamsCount: fetchedTeams.length,
    totalMembersCount,
    initialDocsCreated,
  };
}

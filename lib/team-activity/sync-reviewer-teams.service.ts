import { fetchWebReviewerTeams } from "@/lib/github/github.fetcher";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { upsertTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { getReviewers, upsertReviewers } from "@/db/reviewers/reviewers.db";
import type {
  TeamReviewersDocument,
  ReviewerDocument,
} from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  platform: string;
  syncedTeamsCount: number;
  totalMembersCount: number;
  initialDocsCreated: number;
  teamsUpdated: number;
};

/**
 * Returns whether two team lists contain the same team slugs.
 *
 * @param current The stored team slugs.
 * @param next The freshly fetched team slugs.
 * @returns True when both lists contain the same slugs.
 */
function sameTeams(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return false;

  const sortedCurrent = current.slice().sort();
  const sortedNext = next.slice().sort();

  return sortedCurrent.every((team, index) => team === sortedNext[index]);
}

/**
 * Builds a blank reviewer document for a newly discovered team member.
 *
 * @param teams The team slugs the member currently belongs to.
 * @returns The reviewer document to persist.
 */
function buildEmptyReviewer(
  teams: string[],
): Omit<ReviewerDocument, "schemaVersion"> {
  return {
    teams,
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
    lastUpdated: new Date(),
  };
}

/**
 * Syncs reviewer teams from GitHub into Firestore.
 *
 * Fetches web reviewer teams and writes to `teamReviewers/{platform}`.
 * Also bootstraps reviewer documents for any team members that do not yet have
 * one, and updates the stored `teams` list when a member's teams change. All
 * reviewer reads and writes are batched instead of done per member.
 *
 * Does not fetch any PR or cycle data — that is handled by the separate
 * `sync-review-cycles` cron job.
 *
 * @returns A summary of the sync operation.
 */
export async function syncReviewerTeams(): Promise<SyncSummary> {
  const platform: ContributionPlatform = "WEB";

  const fetchedTeams = await fetchWebReviewerTeams();

  const teamDoc: Omit<TeamReviewersDocument, "schemaVersion"> = {
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
  let teamsUpdated = 0;

  // One read for every member instead of a per-member lookup, then one batched
  // write. Existing docs keep their metrics; only changed memberships are
  // rewritten.
  const existingReviewers = await getReviewers(
    Array.from(memberToTeams.keys()),
  );
  const updates: Array<{
    login: string;
    doc: Omit<ReviewerDocument, "schemaVersion">;
  }> = [];

  for (const [login, teams] of memberToTeams) {
    const existing = existingReviewers.get(login);

    if (!existing) {
      updates.push({ login, doc: buildEmptyReviewer(teams) });
      initialDocsCreated++;
      continue;
    }

    if (!sameTeams(existing.teams, teams)) {
      const writable: Omit<ReviewerDocument, "schemaVersion"> = existing;
      updates.push({ login, doc: { ...writable, teams } });
      teamsUpdated++;
    }
  }

  await upsertReviewers(updates);

  const totalMembersCount = fetchedTeams.reduce(
    (sum, team) => sum + team.members.length,
    0,
  );

  return {
    platform,
    syncedTeamsCount: fetchedTeams.length,
    totalMembersCount,
    initialDocsCreated,
    teamsUpdated,
  };
}

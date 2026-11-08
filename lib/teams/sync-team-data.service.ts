import { getAllUsers } from "@/db/users/users.db";
import { getTeamById, upsertTeam } from "@/db/teams/teams.db";
import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { TEAM_DEFINITIONS } from "@/lib/domain/team-definitions";
import type {
  TeamLead,
  TeamLeadRole,
  TeamMember,
} from "@/lib/domain/teams.types";
import { fetchGoodFirstIssues } from "@/lib/github/github-gfis.fetcher";

type TeamDataSyncSummary = {
  skippedIssuesCount: number;
  totalIssuesCount: number;
  updatedTeamsCount: number;
};

/**
 * Builds a lookup of team ids to the current team lead and lead trainee users assigned in the users collection.
 *
 * @returns The derived leads keyed by stable team id.
 */
async function getLeadsByTeamId(): Promise<Map<string, TeamLead[]>> {
  const users = await getAllUsers();

  return new Map(
    TEAM_DEFINITIONS.map((team) => [
      team.teamId,
      users
        .filter(
          (user) =>
            (user.role === "TEAM_LEAD" || user.role === "LEAD_TRAINEE") &&
            user.platform === team.platform &&
            user.team === team.teamKey &&
            Boolean(user.githubUsername.trim()),
        )
        .map((user) => ({
          role: user.role as TeamLeadRole,
          uid: user.id,
          username: user.githubUsername,
        })),
    ]),
  );
}

/**
 * Builds a lookup of team ids to the current team member users assigned in the users collection.
 *
 * @returns The derived members keyed by stable team id.
 */
export async function getMembersByTeamId(): Promise<Map<string, TeamMember[]>> {
  const users = await getAllUsers();

  return new Map(
    TEAM_DEFINITIONS.map((team) => [
      team.teamId,
      users
        .filter(
          (user) =>
            user.role === "TEAM_MEMBER" &&
            user.platform === team.platform &&
            user.team === team.teamKey &&
            Boolean(user.githubUsername.trim()),
        )
        .map((user) => ({
          uid: user.id,
          username: user.githubUsername,
        })),
    ]),
  );
}

/**
 * Refreshes each team's GFI count, leads, members, and metadata from GitHub
 * and the users collection, then stores the result in the teams collection.
 *
 * @returns A summary of the sync outcome.
 */
export async function syncTeamData(): Promise<TeamDataSyncSummary> {
  const [webIssues, androidIssues, leadsByTeamId, membersByTeamId] =
    await Promise.all([
      fetchGoodFirstIssues(GITHUB_REPOS.WEB),
      fetchGoodFirstIssues(GITHUB_REPOS.ANDROID),
      getLeadsByTeamId(),
      getMembersByTeamId(),
    ]);
  const issues = [...webIssues, ...androidIssues];
  const gfiCountByTeam = new Map<string, number>(
    TEAM_DEFINITIONS.map((team) => [team.teamId, 0]),
  );
  let skippedIssuesCount = 0;

  for (const issue of issues) {
    const team = TEAM_DEFINITIONS.find(
      (candidate) => candidate.linkedProject === issue.linkedProject,
    );

    if (!team) {
      skippedIssuesCount += 1;
      continue;
    }

    const currentCount = gfiCountByTeam.get(team.teamId);

    if (currentCount === undefined) {
      skippedIssuesCount += 1;
      continue;
    }

    gfiCountByTeam.set(team.teamId, currentCount + 1);
  }

  const lastUpdated = new Date();

  await Promise.all(
    TEAM_DEFINITIONS.map(async (team) => {
      const existingTeam = await getTeamById(team.teamId);

      await upsertTeam(team.teamId, {
        gfiCount: gfiCountByTeam.get(team.teamId) ?? 0,
        lastUpdated,
        leads: leadsByTeamId.get(team.teamId) ?? existingTeam?.leads ?? [],
        members:
          membersByTeamId.get(team.teamId) ?? existingTeam?.members ?? [],
        platform: team.platform,
        teamName: team.teamName,
      });
    }),
  );

  return {
    skippedIssuesCount,
    totalIssuesCount: issues.length,
    updatedTeamsCount: TEAM_DEFINITIONS.length,
  };
}

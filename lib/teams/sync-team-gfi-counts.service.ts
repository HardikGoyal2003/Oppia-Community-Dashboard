import { getAllUsers } from "@/db/users/users.db";
import { getTeamById, upsertTeam } from "@/db/teams/teams.db";
import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { TEAM_DEFINITIONS } from "@/lib/domain/team-definitions";
import type {
  TeamGfiCounts,
  TeamLead,
  TeamLeadRole,
} from "@/lib/domain/teams.types";
import { fetchGoodFirstIssues } from "@/lib/github/github.fetcher";
import type { GitHubGoodFirstIssue } from "@/lib/github/github.types";

type GfiDomain = keyof TeamGfiCounts;

type GfiSyncSummary = {
  skippedIssuesCount: number;
  totalIssuesCount: number;
  updatedTeamsCount: number;
};

/**
 * Resolves the normalized GFI domain from GitHub issue labels.
 *
 * @param issue The good first issue to classify.
 * @returns The normalized domain key, or null when no supported domain label exists.
 */
function getGfiDomain(issue: GitHubGoodFirstIssue): GfiDomain | null {
  const labelSet = new Set(issue.labels.map((label) => label.toLowerCase()));

  if (labelSet.has("frontend")) {
    return "frontend";
  }

  if (labelSet.has("backend")) {
    return "backend";
  }

  if (labelSet.has("full-stack")) {
    return "fullstack";
  }

  return null;
}

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
 * Recomputes team-level GFI counts from GitHub and stores them in the teams collection.
 *
 * @returns A summary of the sync outcome.
 */
export async function syncTeamGfiCounts(): Promise<GfiSyncSummary> {
  const [webIssues, androidIssues, leadsByTeamId] = await Promise.all([
    fetchGoodFirstIssues(GITHUB_REPOS.WEB),
    fetchGoodFirstIssues(GITHUB_REPOS.ANDROID),
    getLeadsByTeamId(),
  ]);
  const issues = [...webIssues, ...androidIssues];
  const countsByTeam = new Map<string, TeamGfiCounts>(
    TEAM_DEFINITIONS.map((team) => [
      team.teamId,
      { frontend: 0, backend: 0, fullstack: 0, uncategorized: 0 },
    ]),
  );
  let skippedIssuesCount = 0;

  for (const issue of issues) {
    const gfiDomain = getGfiDomain(issue);
    const team = TEAM_DEFINITIONS.find(
      (candidate) => candidate.linkedProject === issue.linkedProject,
    );

    if (!team) {
      skippedIssuesCount += 1;
      continue;
    }

    const currentCounts = countsByTeam.get(team.teamId);

    if (!currentCounts) {
      skippedIssuesCount += 1;
      continue;
    }

    if (!gfiDomain) {
      currentCounts.uncategorized += 1;
      continue;
    }

    currentCounts[gfiDomain] += 1;
  }

  const lastUpdated = new Date();

  await Promise.all(
    TEAM_DEFINITIONS.map(async (team) => {
      const existingTeam = await getTeamById(team.teamId);

      await upsertTeam(team.teamId, {
        gfiCounts: countsByTeam.get(team.teamId) ?? {
          backend: 0,
          frontend: 0,
          fullstack: 0,
          uncategorized: 0,
        },
        lastUpdated,
        leads: leadsByTeamId.get(team.teamId) ?? existingTeam?.leads ?? [],
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

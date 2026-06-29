import { requestGitHubRestAll } from "./github.rest";
import { fetchGitHubRateLimit } from "./github.rate-limit";

const ORG = "oppia";
const WEB_TEAM_SLUG = "all-web-dev-teams";

type GitHubTeamResponse = {
  slug: string;
  name: string;
  description: string | null;
};

type GitHubTeamMemberResponse = {
  login: string;
  avatar_url: string;
};

export type FetchedTeam = {
  teamSlug: string;
  teamName: string;
  description: string;
  members: Array<{
    username: string;
    avatarUrl: string;
  }>;
};

export async function fetchWebReviewerTeams(): Promise<FetchedTeam[]> {
  console.log("Fetching web reviewer teams from GitHub...");

  const childTeams = await requestGitHubRestAll<GitHubTeamResponse>(
    `/orgs/${ORG}/teams/${WEB_TEAM_SLUG}/teams`,
  );

  console.log(`Found ${childTeams.length} web sub-teams.`);

  const teamsWithMembers: FetchedTeam[] = [];

  for (const team of childTeams) {
    console.log(`Fetching members for ${team.slug}...`);

    const members = await requestGitHubRestAll<GitHubTeamMemberResponse>(
      `/orgs/${ORG}/teams/${team.slug}/members`,
    );

    teamsWithMembers.push({
      teamSlug: team.slug,
      teamName: team.name,
      description: team.description ?? "",
      members: members.map((member) => ({
        username: member.login,
        avatarUrl: member.avatar_url,
      })),
    });

    console.log(`  → ${members.length} members in ${team.slug}.`);
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return teamsWithMembers;
}

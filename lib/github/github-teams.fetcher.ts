import { requestGitHubRest } from "./github.rest";

const ORG = "oppia";
const WEB_TEAM_SLUG = "all-web-dev-teams";

type GitHubTeamResponse = {
  slug: string;
  name: string;
};

type GitHubTeamMemberResponse = {
  login: string;
  avatar_url: string;
};

export type FetchedTeam = {
  teamSlug: string;
  teamName: string;
  members: Array<{
    username: string;
    avatarUrl: string;
  }>;
};

/**
 * Fetches all child teams under all-web-dev-teams along with their members.
 *
 * @returns The list of web sub-teams with their members.
 */
export async function fetchWebReviewerTeams(): Promise<FetchedTeam[]> {
  console.log("Fetching web reviewer teams from GitHub...");

  const childTeams = await requestGitHubRest<GitHubTeamResponse[]>(
    `/orgs/${ORG}/teams/${WEB_TEAM_SLUG}/teams`,
  );

  console.log(`Found ${childTeams.length} web sub-teams.`);

  const teamsWithMembers: FetchedTeam[] = [];

  for (const team of childTeams) {
    console.log(`Fetching members for ${team.slug}...`);

    const members = await requestGitHubRest<GitHubTeamMemberResponse[]>(
      `/orgs/${ORG}/teams/${team.slug}/members`,
    );

    teamsWithMembers.push({
      teamSlug: team.slug,
      teamName: team.name,
      members: members.map((member) => ({
        username: member.login,
        avatarUrl: member.avatar_url,
      })),
    });

    console.log(`  → ${members.length} members in ${team.slug}.`);
  }

  return teamsWithMembers;
}

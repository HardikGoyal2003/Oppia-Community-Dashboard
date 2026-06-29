import { requestGitHubRestAll } from "./github.rest";
import { fetchGitHubRateLimit } from "./github.rate-limit";

const ORG = "oppia";
const REPO = "oppia";

type GitHubPullResponse = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  user: { login: string } | null;
  assignees: Array<{ login: string }>;
};

export type OpenPRAssignment = {
  prNumber: number;
  title: string;
  url: string;
};

export type MemberPRMap = Map<string, OpenPRAssignment[]>;

export async function fetchAssignedPRs(): Promise<MemberPRMap> {
  console.log("Fetching open PRs from oppia/oppia...");

  const prs = await requestGitHubRestAll<GitHubPullResponse>(
    `/repos/${ORG}/${REPO}/pulls?state=open`,
  );

  console.log(`Found ${prs.length} open PRs.`);

  const map: MemberPRMap = new Map();

  for (const pr of prs) {
    const assignees = pr.assignees;
    if (!assignees || assignees.length === 0) continue;

    const author = pr.user?.login;

    const assignment: OpenPRAssignment = {
      prNumber: pr.number,
      title: pr.title,
      url: pr.html_url,
    };

    for (const assignee of assignees) {
      if (assignee.login === author) continue;
      const existing = map.get(assignee.login) ?? [];
      existing.push(assignment);
      map.set(assignee.login, existing);
    }
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return map;
}

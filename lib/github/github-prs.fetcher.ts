import { requestGitHubRestAll } from "./github.rest";
import { fetchGitHubRateLimit } from "./github.rate-limit";

const ORG = "oppia";
const REPO = "oppia";

type GitHubPullResponse = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  requested_reviewers: Array<{ login: string }>;
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
    const reviewers = pr.requested_reviewers;
    if (!reviewers || reviewers.length === 0) continue;

    const assignment: OpenPRAssignment = {
      prNumber: pr.number,
      title: pr.title,
      url: pr.html_url,
    };

    for (const reviewer of reviewers) {
      const existing = map.get(reviewer.login) ?? [];
      existing.push(assignment);
      map.set(reviewer.login, existing);
    }
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return map;
}

import { requestGitHubRestAll } from "./github.rest";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import type { AssignedPR } from "@/lib/domain/reviewer-teams.types";

const ORG = "oppia";
const REPO = "oppia";

type GitHubPullResponse = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  requested_reviewers: Array<{ login: string }>;
};

export type MemberPRMap = Map<string, AssignedPR[]>;

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

    const assignedPR: AssignedPR = {
      prNumber: pr.number,
      title: pr.title,
      url: pr.html_url,
      waitingSince: pr.created_at,
    };

    for (const reviewer of reviewers) {
      const existing = map.get(reviewer.login) ?? [];
      existing.push(assignedPR);
      map.set(reviewer.login, existing);
    }
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return map;
}

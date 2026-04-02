import { mapGitHubGoodFirstIssueNodes } from "./github-gfis.mapper";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import { fetchGoodFirstIssueNodes } from "./github.shared";
import type { GitHubRepoTarget } from "./github.fetcher";
import type { GitHubGoodFirstIssue } from "./github.types";

/**
 * Fetches all open, unassigned good first issues for a repository.
 *
 * @param target The GitHub repository to inspect.
 * @returns The normalized good first issue list.
 */
export async function fetchGoodFirstIssues(
  target: GitHubRepoTarget,
): Promise<GitHubGoodFirstIssue[]> {
  console.log(
    `Fetching open unassigned good first issues for ${target.owner}/${target.repo}...`,
  );

  const issues = await fetchGoodFirstIssueNodes(target);

  console.log(
    `Fetched ${issues.length} good first issues from ${target.owner}/${target.repo}.`,
  );

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return mapGitHubGoodFirstIssueNodes(issues);
}

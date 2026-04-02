import { mapGitHubIssueNodes } from "./github-issues.mapper";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import {
  fetchOrgAndCollaboratorAccess,
  fetchRecentIssueNodes,
} from "./github.shared";
import type { GitHubRepoTarget } from "./github.fetcher";
import type { GitHubIssue } from "./github.types";

/**
 * Fetches unanswered issues whose latest recent comment came from a non-maintainer.
 *
 * @param target The GitHub repository to inspect.
 * @returns The filtered unanswered issue nodes for the dashboard.
 */
export async function fetchUnansweredIssues(
  target: GitHubRepoTarget,
): Promise<GitHubIssue[]> {
  console.log("Fetching collaborators and org members...");

  const orgData = await fetchOrgAndCollaboratorAccess(target);
  const orgMembers = new Set(
    orgData.organization.membersWithRole.nodes.map((member) => member.login),
  );
  const collaborators = orgData.repository.collaborators.edges;
  const collabAll = new Set(collaborators.map((entry) => entry.node.login));
  const maintainers = new Set(
    collaborators
      .filter((entry) =>
        ["ADMIN", "MAINTAIN", "WRITE"].includes(entry.permission),
      )
      .map((entry) => entry.node.login),
  );

  console.log(`Org members: ${orgMembers.size}`);
  console.log(`Collaborators: ${collabAll.size}`);
  console.log(`Maintainers: ${maintainers.size}`);

  console.log("Fetching recent issues (30-day window)...");
  const issues = await fetchRecentIssueNodes(target);
  console.log(`Fetched ${issues.length} recent issues.`);

  const cutoffTime = Date.now() - 30 * 86400 * 1000;
  const filtered = issues.filter((issue) => {
    if (issue.state === "CLOSED") {
      return false;
    }

    const lastComment = issue.comments.nodes[0];

    if (!lastComment) {
      return false;
    }

    const ts = new Date(lastComment.createdAt).getTime();

    if (ts < cutoffTime) {
      return false;
    }

    const commenter = lastComment.author?.login;

    if (!commenter) {
      return true;
    }

    const isAllowed =
      orgMembers.has(commenter) ||
      collabAll.has(commenter) ||
      maintainers.has(commenter) ||
      commenter === "oppia-github-app";

    return !isAllowed;
  });

  console.log(
    "\nIssues where last comment in past 30 days is from non-maintainer",
  );
  console.log("----------------------------------------------------------");
  console.log(`\nTotal filtered issues: ${filtered.length}`);

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return mapGitHubIssueNodes(filtered);
}

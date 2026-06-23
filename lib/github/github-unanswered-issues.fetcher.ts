import { getOrgMeta } from "@/db/org-meta/org-meta.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { mapGitHubIssueNodes } from "./github-issues.mapper";
import {
  fetchOrgAndCollaboratorAccess,
  fetchRecentIssueNodes,
} from "./github.query-helpers";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import type { GitHubIssue, GitHubRepoTarget } from "./github.types";

/**
 * Fetches unanswered issues whose latest recent comment came from a non-maintainer.
 *
 * @param target The GitHub repository to inspect.
 * @param platform Optional platform to fetch cached org meta from Firestore.
 * @returns The filtered unanswered issue nodes for the dashboard.
 */
export async function fetchUnansweredIssues(
  target: GitHubRepoTarget,
  platform: ContributionPlatform,
): Promise<GitHubIssue[]> {
  let orgMembers: Set<string>;
  let collabAll: Set<string>;
  let maintainers: Set<string>;

  if (platform) {
    const cached = await getOrgMeta(platform);

    if (cached) {
      console.log("Using cached org meta from Firestore...");
      orgMembers = new Set(cached.orgMembers);
      collabAll = new Set(cached.collaborators.map((c) => c.login));
      maintainers = new Set(
        cached.collaborators
          .filter((c) => ["ADMIN", "MAINTAIN", "WRITE"].includes(c.permission))
          .map((c) => c.login),
      );
    } else {
      console.log("No cached org meta found, falling back to GitHub API...");
      const fetched = await fetchOrgAndCollaboratorAccess(target);
      orgMembers = new Set(
        fetched.organization.membersWithRole.nodes.map((m) => m.login),
      );
      const collabEdges = fetched.repository.collaborators.edges;
      collabAll = new Set(collabEdges.map((e) => e.node.login));
      maintainers = new Set(
        collabEdges
          .filter((e) => ["ADMIN", "MAINTAIN", "WRITE"].includes(e.permission))
          .map((e) => e.node.login),
      );
    }
  } else {
    console.log("Fetching collaborators and org members from GitHub...");
    const orgData = await fetchOrgAndCollaboratorAccess(target);
    orgMembers = new Set(
      orgData.organization.membersWithRole.nodes.map((member) => member.login),
    );
    const collaborators = orgData.repository.collaborators.edges;
    collabAll = new Set(collaborators.map((entry) => entry.node.login));
    maintainers = new Set(
      collaborators
        .filter((entry) =>
          ["ADMIN", "MAINTAIN", "WRITE"].includes(entry.permission),
        )
        .map((entry) => entry.node.login),
    );
  }

  console.log(`Org members: ${orgMembers.size}`);
  console.log(`Collaborators: ${collabAll.size}`);
  console.log(`Maintainers: ${maintainers.size}`);

  console.log("Fetching recent issues (15-day window)...");
  const issues = await fetchRecentIssueNodes(target);
  console.log(`Fetched ${issues.length} recent issues.`);

  const cutoffTime = Date.now() - 15 * 86400 * 1000;
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
    "\nIssues where last comment in past 15 days is from non-maintainer",
  );
  console.log("----------------------------------------------------------");
  console.log(`\nTotal filtered issues: ${filtered.length}`);

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return mapGitHubIssueNodes(filtered);
}

import type { OrgMetaRecord } from "@/db/org-meta/org-meta.mapper";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { mapGitHubIssueNodes } from "./github-issues.mapper";
import { resolveMaintainerAccess } from "./github-maintainers";
import { fetchRecentIssueNodes } from "./github.query-helpers";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import type { GitHubIssue, GitHubRepoTarget } from "./github.types";

/**
 * Fetches unanswered issues whose latest recent comment came from a non-maintainer.
 *
 * @param target The GitHub repository to inspect.
 * @param platform Optional platform to fetch cached org meta from Firestore.
 * @param cachedOrgMeta Optional org meta provided by the client (from localStorage).
 * @returns The filtered unanswered issue nodes for the dashboard.
 */
export async function fetchUnansweredIssues(
  target: GitHubRepoTarget,
  platform: ContributionPlatform,
  cachedOrgMeta?: Omit<OrgMetaRecord, "schemaVersion">,
): Promise<GitHubIssue[]> {
  const {
    orgMembers,
    collaborators: collabAll,
    maintainers,
  } = await resolveMaintainerAccess(target, platform, cachedOrgMeta);

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

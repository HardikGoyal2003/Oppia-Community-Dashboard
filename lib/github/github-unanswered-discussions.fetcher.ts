import type { OrgMetaRecord } from "@/db/org-meta/org-meta.mapper";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  getLatestDiscussionActivity,
  mapGitHubDiscussionNodes,
} from "./github-discussions.mapper";
import { resolveMaintainerAccess } from "./github-maintainers";
import { fetchRecentDiscussionNodes } from "./github.query-helpers";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import type { GitHubDiscussion, GitHubRepoTarget } from "./github.types";

/**
 * Fetches discussions whose latest comment or reply came from a non-maintainer.
 *
 * @param target The GitHub repository to inspect.
 * @param platform Platform used to read cached org metadata.
 * @param cachedOrgMeta Optional org meta provided by the client (from localStorage).
 * @returns The filtered unanswered discussion list for the dashboard.
 */
export async function fetchUnansweredDiscussions(
  target: GitHubRepoTarget,
  platform: ContributionPlatform,
  cachedOrgMeta?: Omit<OrgMetaRecord, "schemaVersion">,
): Promise<GitHubDiscussion[]> {
  const { orgMembers, collaborators, maintainers } =
    await resolveMaintainerAccess(target, platform, cachedOrgMeta);

  console.log(`Org members: ${orgMembers.size}`);
  console.log(`Collaborators: ${collaborators.size}`);
  console.log(`Maintainers: ${maintainers.size}`);

  console.log(`Fetching recent discussions for ${platform} (30-day window)...`);
  const discussions = await fetchRecentDiscussionNodes(target);
  console.log(`Fetched ${discussions.length} recent discussions.`);

  const cutoffTime = Date.now() - 30 * 86400 * 1000;
  const filtered = discussions.filter((discussion) => {
    if (discussion.closed) {
      return false;
    }

    if (discussion.author?.login === "oppiabot") {
      return false;
    }

    const latestActivity = getLatestDiscussionActivity(discussion);
    const lastActivityAt = latestActivity?.createdAt ?? discussion.createdAt;
    const ts = new Date(lastActivityAt).getTime();

    if (Number.isNaN(ts) || ts < cutoffTime) {
      return false;
    }

    // A discussion with no human comments has not received a first response yet.
    if (!latestActivity) {
      return true;
    }

    const commenter = latestActivity.authorLogin;

    if (!commenter) {
      return true;
    }

    const isMaintainer =
      orgMembers.has(commenter) ||
      collaborators.has(commenter) ||
      maintainers.has(commenter);

    return !isMaintainer;
  });

  console.log(
    "\nDiscussions where the latest comment or reply is from a non-maintainer",
  );
  console.log("----------------------------------------------------------");
  console.log(`\nTotal filtered discussions: ${filtered.length}`);

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.graphql);

  return mapGitHubDiscussionNodes(filtered);
}

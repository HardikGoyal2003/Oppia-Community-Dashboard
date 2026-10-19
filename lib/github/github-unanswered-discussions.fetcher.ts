import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { mapGitHubDiscussionNodes } from "./github-discussions.mapper";
import { fetchRecentDiscussionNodes } from "./github.query-helpers";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import type { GitHubDiscussion, GitHubRepoTarget } from "./github.types";

/**
 * Fetches open discussions opened within the last 30 days that were not opened
 * by the Oppia bot.
 *
 * @param target The GitHub repository to inspect.
 * @param platform Platform the discussions belong to (retained for call-site parity).
 * @returns The filtered unanswered discussion list for the dashboard.
 */
export async function fetchUnansweredDiscussions(
  target: GitHubRepoTarget,
  platform: ContributionPlatform,
): Promise<GitHubDiscussion[]> {
  console.log(`Fetching recent discussions for ${platform} (30-day window)...`);
  const discussions = await fetchRecentDiscussionNodes(target);
  console.log(`Fetched ${discussions.length} recent discussions.`);

  const cutoffTime = Date.now() - 30 * 86400 * 1000;
  const filtered = discussions.filter((discussion) => {
    if (discussion.closed) {
      return false;
    }

    const ts = new Date(discussion.createdAt).getTime();

    if (Number.isNaN(ts) || ts < cutoffTime) {
      return false;
    }

    if (discussion.author?.login === "oppiabot") {
      return false;
    }

    return true;
  });

  console.log("\nOpen discussions from the past 30 days (excluding oppiabot)");
  console.log("----------------------------------------------------------");
  console.log(`\nTotal filtered discussions: ${filtered.length}`);

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return mapGitHubDiscussionNodes(filtered);
}

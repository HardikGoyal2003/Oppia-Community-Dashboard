import { LibMappingError } from "@/lib/lib.errors";
import type { GitHubDiscussion, GitHubDiscussionNode } from "./github.types";

/**
 * Validates that a GitHub discussion node contains the fields required by the dashboard formatter.
 *
 * @param discussion The raw GitHub discussion node to validate.
 * @returns Nothing. Throws when required discussion fields are missing.
 */
function assertFormattableDiscussion(discussion: GitHubDiscussionNode): void {
  if (!discussion.createdAt) {
    throw new LibMappingError(
      "GitHubDiscussion",
      `Discussion ${discussion.number} is missing the createdAt timestamp.`,
    );
  }
}

/**
 * Formats raw GitHub discussion nodes into the dashboard discussion shape.
 *
 * @param rawData The raw GitHub discussion nodes returned from the GitHub fetcher.
 * @returns The normalized discussion list expected by the dashboard.
 */
export function mapGitHubDiscussionNodes(
  rawData: GitHubDiscussionNode[],
): GitHubDiscussion[] {
  return rawData.map((discussion) => {
    assertFormattableDiscussion(discussion);

    return {
      discussionNumber: discussion.number,
      discussionUrl: discussion.url,
      discussionTitle: discussion.title,
      createdAt: discussion.createdAt,
    };
  });
}

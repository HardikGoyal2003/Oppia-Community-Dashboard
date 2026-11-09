import { LibMappingError } from "@/lib/lib.errors";
import type { GitHubDiscussion, GitHubDiscussionNode } from "./github.types";

type DiscussionActivity = {
  createdAt: string;
  authorLogin?: string;
};

/** Automated accounts whose comments do not count as a human response. */
const DISCUSSION_BOT_LOGINS = new Set(["oppiabot", "oppia-github-app"]);

/**
 * Returns the most recent human comment or reply activity for a discussion.
 *
 * @param discussion The raw GitHub discussion node.
 * @returns The latest human activity, or null when the discussion has no human comments.
 */
export function getLatestDiscussionActivity(
  discussion: GitHubDiscussionNode,
): DiscussionActivity | null {
  let latest: DiscussionActivity | null = null;

  for (const comment of discussion.comments.nodes) {
    if (!isBotLogin(comment.author?.login)) {
      latest = getNewerActivity(
        latest,
        comment.createdAt,
        comment.author?.login,
      );
    }

    for (const reply of comment.replies.nodes) {
      if (!isBotLogin(reply.author?.login)) {
        latest = getNewerActivity(latest, reply.createdAt, reply.author?.login);
      }
    }
  }

  return latest;
}

/**
 * Checks whether a login belongs to an automated discussion account.
 *
 * @param login The GitHub login to check.
 * @returns True when the login is a known bot account.
 */
function isBotLogin(login: string | undefined): boolean {
  return login !== undefined && DISCUSSION_BOT_LOGINS.has(login);
}

/**
 * Picks the newer of two discussion activity records.
 *
 * @param current The activity selected so far.
 * @param createdAt The candidate activity timestamp.
 * @param authorLogin The candidate activity author.
 * @returns The newer activity record.
 */
function getNewerActivity(
  current: DiscussionActivity | null,
  createdAt: string,
  authorLogin?: string,
): DiscussionActivity {
  if (!current) {
    return { createdAt, authorLogin };
  }

  const currentTime = new Date(current.createdAt).getTime();
  const candidateTime = new Date(createdAt).getTime();

  if (Number.isNaN(candidateTime) || candidateTime <= currentTime) {
    return current;
  }

  return { createdAt, authorLogin };
}

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
 * Validates that a normalized GitHub discussion matches the app-facing contract.
 *
 * @param discussion The normalized discussion to validate.
 * @returns Nothing. Throws when the normalized discussion shape is invalid.
 */
function assertNormalizedGitHubDiscussion(discussion: GitHubDiscussion): void {
  if (typeof discussion.discussionNumber !== "number") {
    throw new LibMappingError(
      "GitHubDiscussion",
      "Normalized discussion is missing a numeric discussionNumber.",
    );
  }

  if (
    typeof discussion.discussionUrl !== "string" ||
    !discussion.discussionUrl
  ) {
    throw new LibMappingError(
      "GitHubDiscussion",
      "Normalized discussion is missing discussionUrl.",
    );
  }

  if (
    typeof discussion.discussionTitle !== "string" ||
    !discussion.discussionTitle
  ) {
    throw new LibMappingError(
      "GitHubDiscussion",
      "Normalized discussion is missing discussionTitle.",
    );
  }

  if (
    typeof discussion.lastCommentCreatedAt !== "string" ||
    !discussion.lastCommentCreatedAt
  ) {
    throw new LibMappingError(
      "GitHubDiscussion",
      "Normalized discussion is missing lastCommentCreatedAt.",
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

    const latestActivity = getLatestDiscussionActivity(discussion);

    const normalizedDiscussion: GitHubDiscussion = {
      discussionNumber: discussion.number,
      discussionUrl: discussion.url,
      discussionTitle: discussion.title,
      createdAt: discussion.createdAt,
      lastCommentCreatedAt: latestActivity?.createdAt ?? discussion.createdAt,
    };

    assertNormalizedGitHubDiscussion(normalizedDiscussion);

    return normalizedDiscussion;
  });
}

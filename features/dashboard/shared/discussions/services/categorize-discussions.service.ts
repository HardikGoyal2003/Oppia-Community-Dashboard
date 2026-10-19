import type { Discussion } from "@/lib/domain/discussions.types";
import type { GitHubDiscussion } from "@/lib/github/github.types";
import type { CategorizedProjectDiscussions } from "../../../dashboard.types";

function toDiscussion(
  discussion: GitHubDiscussion,
  isArchived: boolean,
): Discussion {
  return {
    discussionNumber: discussion.discussionNumber,
    discussionUrl: discussion.discussionUrl,
    discussionTitle: discussion.discussionTitle,
    lastCommentCreatedAt: discussion.lastCommentCreatedAt,
    isArchived,
  };
}

export function categorizeDiscussions(
  liveDiscussions: GitHubDiscussion[],
  archivedDiscussions: Discussion[],
): CategorizedProjectDiscussions {
  const archivedNumbers = new Set(
    archivedDiscussions.map((discussion) => discussion.discussionNumber),
  );

  const active = liveDiscussions
    .filter((discussion) => !archivedNumbers.has(discussion.discussionNumber))
    .map((discussion) => toDiscussion(discussion, false));

  return {
    active,
    archive: archivedDiscussions,
  };
}

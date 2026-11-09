import type { Discussion } from "@/lib/domain/discussions.types";
import type { GitHubDiscussion } from "@/lib/github/github.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { CategorizedProjectDiscussions } from "../../../dashboard.types";
import { unarchiveDiscussionForPlatform } from "./archived-discussions-api.service";

function getWaitingTimestamp(discussion: Discussion): number {
  return new Date(
    discussion.lastCommentCreatedAt ?? discussion.createdAt,
  ).getTime();
}

function sortDiscussionsByWaitingTime(discussions: Discussion[]): Discussion[] {
  return [...discussions].sort(
    (left, right) => getWaitingTimestamp(left) - getWaitingTimestamp(right),
  );
}

function toDiscussion(
  discussion: GitHubDiscussion,
  isArchived: boolean,
): Discussion {
  return {
    discussionNumber: discussion.discussionNumber,
    discussionUrl: discussion.discussionUrl,
    discussionTitle: discussion.discussionTitle,
    createdAt: discussion.createdAt,
    lastCommentCreatedAt: discussion.lastCommentCreatedAt,
    isArchived,
  };
}

export async function categorizeDiscussions(
  liveDiscussions: GitHubDiscussion[],
  archivedDiscussions: Discussion[],
  platform: ContributionPlatform,
): Promise<CategorizedProjectDiscussions> {
  const result: CategorizedProjectDiscussions = {
    active: [],
    archive: [...archivedDiscussions],
  };

  for (const rawDiscussion of liveDiscussions) {
    const archiveIndex = result.archive.findIndex(
      (discussion) =>
        discussion.discussionNumber === rawDiscussion.discussionNumber,
    );

    const archivedDiscussion =
      archiveIndex === -1 ? null : result.archive[archiveIndex];
    const archivedAt = archivedDiscussion?.archivedAt;

    const isUpdated =
      archiveIndex !== -1 &&
      archivedAt !== undefined &&
      new Date(rawDiscussion.lastCommentCreatedAt).getTime() >
        new Date(archivedAt).getTime();

    if (isUpdated) {
      result.archive.splice(archiveIndex, 1);

      try {
        await unarchiveDiscussionForPlatform(
          rawDiscussion.discussionNumber,
          platform,
        );
      } catch (error) {
        console.error("Failed to unarchive updated discussion.", error);
      }
    }

    if (archiveIndex === -1 || isUpdated) {
      result.active.push(toDiscussion(rawDiscussion, false));
    }
  }

  result.active = sortDiscussionsByWaitingTime(result.active);
  result.archive = sortDiscussionsByWaitingTime(result.archive);

  return result;
}

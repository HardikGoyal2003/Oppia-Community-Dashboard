import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Discussion } from "@/lib/domain/discussions.types";

export async function getArchivedDiscussionsForPlatform(
  platform: ContributionPlatform,
): Promise<Discussion[]> {
  const response = await fetch(
    `/api/archived-discussions?platform=${platform}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch archived discussions.");
  }

  const data = (await response.json()) as {
    archivedDiscussions: Discussion[];
  };
  return data.archivedDiscussions;
}

export async function archiveDiscussionForPlatform(
  discussion: Discussion,
  platform: ContributionPlatform,
): Promise<void> {
  const response = await fetch("/api/archived-discussions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      discussion,
      platform,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to archive discussion.");
  }
}

export async function unarchiveDiscussionForPlatform(
  discussionNumber: number,
  platform: ContributionPlatform,
): Promise<void> {
  const response = await fetch("/api/archived-discussions", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      discussionNumber,
      platform,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to unarchive discussion.");
  }
}

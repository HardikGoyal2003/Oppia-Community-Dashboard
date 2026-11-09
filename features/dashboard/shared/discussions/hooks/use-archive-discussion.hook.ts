"use client";

import { useSession } from "next-auth/react";
import type { Discussion } from "@/lib/domain/discussions.types";
import { useProjectDiscussionsStore } from "../store/project-discussions.store";
import { archiveDiscussionForPlatform } from "../services/archived-discussions-api.service";

export function useArchiveDiscussion() {
  const archiveDiscussion = useProjectDiscussionsStore(
    (state) => state.archiveDiscussion,
  );
  const { data: session } = useSession();

  return async (discussion: Discussion) => {
    const platform = session?.user?.platform;

    if (!platform) {
      console.error("User platform is undefined. Cannot archive discussion.");
      return;
    }

    const githubUsername = session?.user?.githubUsername;

    await archiveDiscussionForPlatform(discussion, platform);

    archiveDiscussion(discussion.discussionNumber, {
      archivedBy: githubUsername,
      archivedAt: new Date().toISOString(),
    });
  };
}

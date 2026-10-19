"use client";

import type { Discussion } from "@/lib/domain/discussions.types";
import { useProjectDiscussionsStore } from "../store/project-discussions.store";

export function useMarkDiscussionAsnwered() {
  const removeDiscussion = useProjectDiscussionsStore(
    (state) => state.removeDiscussion,
  );

  return (discussion: Discussion) => {
    removeDiscussion(discussion.discussionNumber);
  };
}

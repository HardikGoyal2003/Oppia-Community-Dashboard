import { create } from "zustand";
import type { Discussion } from "@/lib/domain/discussions.types";
import type { CategorizedProjectDiscussions } from "../../../dashboard.types";

interface ProjectDiscussionsStore {
  discussions: CategorizedProjectDiscussions;
  setDiscussions: (newDiscussions: CategorizedProjectDiscussions) => void;
  archiveDiscussion: (
    discussionNumber: number,
    metadata?: Partial<Pick<Discussion, "archivedBy" | "archivedAt">>,
  ) => void;
  removeDiscussion: (discussionNumber: number) => void;
}

export const useProjectDiscussionsStore = create<ProjectDiscussionsStore>(
  (set) => ({
    discussions: {
      active: [],
      archive: [],
    },

    setDiscussions: (newDiscussions) =>
      set({
        discussions: newDiscussions,
      }),

    archiveDiscussion: (discussionNumber, metadata) =>
      set((state) => {
        const discussionToMove = state.discussions.active.find(
          (discussion) => discussion.discussionNumber === discussionNumber,
        );

        if (!discussionToMove) return {};

        const updatedDiscussion: Discussion = {
          ...discussionToMove,
          isArchived: true,
          ...metadata,
        };

        return {
          discussions: {
            active: state.discussions.active.filter(
              (discussion) => discussion.discussionNumber !== discussionNumber,
            ),
            archive: [...state.discussions.archive, updatedDiscussion],
          },
        };
      }),

    removeDiscussion: (discussionNumber) =>
      set((state) => ({
        discussions: {
          ...state.discussions,
          active: state.discussions.active.filter(
            (discussion) => discussion.discussionNumber !== discussionNumber,
          ),
        },
      })),
  }),
);

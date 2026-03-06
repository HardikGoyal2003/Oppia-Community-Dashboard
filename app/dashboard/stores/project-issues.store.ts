import { create } from 'zustand';
import { CategorizedProjectIssues } from '../dashboard.types';

interface ProjectIssuesStore {
  issues: CategorizedProjectIssues;
  setIssues: (newIssues: CategorizedProjectIssues) => void;
  moveIssue: (
    from: keyof CategorizedProjectIssues,
    to: keyof CategorizedProjectIssues,
    issueNumber: number
  ) => void;
  removeIssue: (
    from: keyof CategorizedProjectIssues,
    issueNumber: number
  ) => void;
}

export const useProjectIssuesStore = create<ProjectIssuesStore>((set) => ({
  issues: {
    leap: [],
    core: [],
    dev: [],
    others: [],
    archive: [],
  },

  setIssues: (newIssues) =>
    set({
      issues: newIssues,
    }),

  moveIssue: (from, to, issueNumber) =>
    set((state) => {
      const issueToMove = state.issues[from].find(
        (i) => i.issueNumber === issueNumber
      );

      if (!issueToMove) return {};

      const updatedIssue = { ...issueToMove, isArchived: true };

      return {
        issues: {
          ...state.issues,
          [from]: state.issues[from].filter(
            (i) => i.issueNumber !== issueNumber
          ),
          [to]: [...state.issues[to], updatedIssue],
        },
      };
    }),

  removeIssue: (from, issueNumber) =>
    set((state) => ({
      issues: {
        ...state.issues,
        [from]: state.issues[from].filter(
          (i) => i.issueNumber !== issueNumber
        ),
      },
    })),
}));

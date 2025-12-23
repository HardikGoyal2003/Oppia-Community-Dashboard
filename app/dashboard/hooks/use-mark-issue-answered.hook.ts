"use client";

import { useProjectIssuesStore } from "../dashboard.store";
import { Issue } from "../dashboard.types";
import { CategorizedProjectIssues } from "../dashboard.types";

export function useMarkIssueAsnwered() {
  const removeIssue = useProjectIssuesStore((state) => state.removeIssue);

  return (issue: Issue) => {

    let from: keyof CategorizedProjectIssues;

    if (
      issue.linkedProject ===
      "[Web] CORE Team (Creators, Operations, Reviewers and Editors)"
    ) {
      from = "core";
    } else if (
      issue.linkedProject ===
      "[Web] LEAP Team (Learners, Educators, Allies, and Parents)"
    ) {
      from = "leap";
    } else if (
      issue.linkedProject === "[Web] Developer Workflow Team"
    ) {
      from = "dev";
    } else {
      from = "others";
    }

    removeIssue(from, issue.issueNumber);
  };
}

"use client";

import { useProjectIssuesStore } from "../dashboard.store";
import { archiveIssue } from "../../../lib/db/archived-issues.service";
import { Issue } from "../dashboard.types";
import { CategorizedProjectIssues } from "../dashboard.types";

export function useArchiveIssue() {
  const moveIssue = useProjectIssuesStore((state) => state.moveIssue);

  return async (issue: Issue) => {
    await archiveIssue(issue);

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

    moveIssue(from, "archive", issue.issueNumber);
  };
}

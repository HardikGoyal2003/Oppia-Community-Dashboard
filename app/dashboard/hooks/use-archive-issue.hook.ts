"use client";

import { useProjectIssuesStore } from "../stores/project-issues.store";
import { archiveIssue } from "../../../db/archived-issues.db";
import { Issue } from "../dashboard.types";
import { CategorizedProjectIssues } from "../dashboard.types";

import { CONSTANTS } from "@/lib/contants";

export function useArchiveIssue() {
  const moveIssue = useProjectIssuesStore((state) => state.moveIssue);

  return async (issue: Issue) => {
    await archiveIssue(issue);

    let from: keyof CategorizedProjectIssues;

    if (
      issue.linkedProject ===
      CONSTANTS.WEB_TEAMS.CORE
    ) {
      from = "core";
    } else if (
      issue.linkedProject ===
      CONSTANTS.WEB_TEAMS.LEAP
    ) {
      from = "leap";
    } else if (
      issue.linkedProject === CONSTANTS.WEB_TEAMS.DEV_WORKFLOW
    ) {
      from = "dev";
    } else {
      from = "others";
    }

    moveIssue(from, "archive", issue.issueNumber);
  };
}

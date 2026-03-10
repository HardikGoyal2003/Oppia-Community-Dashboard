"use client";

import { useProjectIssuesStore } from "../store/project-issues.store";
import { Issue } from "../../../dashboard.types";
import { CategorizedProjectIssues } from "../../../dashboard.types";
import { CONSTANTS } from "@/lib/constants";

export function useMarkIssueAsnwered() {
  const removeIssue = useProjectIssuesStore((state) => state.removeIssue);

  return (issue: Issue) => {

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

    removeIssue(from, issue.issueNumber);
  };
}

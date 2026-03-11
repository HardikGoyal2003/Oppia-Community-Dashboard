"use client";

import { useSession } from "next-auth/react";
import { useProjectIssuesStore } from "../store/project-issues.store";
import { archiveIssue } from "../../../../../db/archived-issues.db";
import { Issue } from "../../../dashboard.types";
import { CategorizedProjectIssues } from "../../../dashboard.types";

import { CONSTANTS } from "@/lib/constants";

export function useArchiveIssue() {
  const moveIssue = useProjectIssuesStore((state) => state.moveIssue);
  const { data: session } = useSession();

  return async (issue: Issue) => {
    const platform = session?.user.platform;

    if (!platform) {
      console.error("User platform is undefined. Cannot archive issue.");
      return;
    }

    await archiveIssue(issue, platform);

    let from: keyof CategorizedProjectIssues;

    if (platform === "ANDROID") {
      if (issue.linkedProject === CONSTANTS.ANDROID_TEAMS.CLAM) {
        from = "team1";
      } else if (
        issue.linkedProject ===
        CONSTANTS.ANDROID_TEAMS.DEV_WORKFLOW_INFRA
      ) {
        from = "team2";
      } else {
        from = "others";
      }
    } else {
      if (issue.linkedProject === CONSTANTS.WEB_TEAMS.LEAP) {
        from = "team1";
      } else if (issue.linkedProject === CONSTANTS.WEB_TEAMS.CORE) {
        from = "team2";
      } else if (
        issue.linkedProject === CONSTANTS.WEB_TEAMS.DEV_WORKFLOW
      ) {
        from = "team3";
      } else {
        from = "others";
      }
    }

    moveIssue(from, "archive", issue.issueNumber);
  };
}

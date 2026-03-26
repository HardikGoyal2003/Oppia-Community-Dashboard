"use client";

import { useSession } from "next-auth/react";
import { useProjectIssuesStore } from "../store/project-issues.store";
import { CategorizedProjectIssues } from "../../../dashboard.types";
import type { Issue } from "@/lib/domain/issues.types";
import { ANDROID_TEAMS, WEB_TEAMS } from "@/lib/config";

export function useMarkIssueAsnwered() {
  const removeIssue = useProjectIssuesStore((state) => state.removeIssue);
  const { data: session } = useSession();

  return (issue: Issue) => {
    const platform = session?.user.platform;

    let from: keyof CategorizedProjectIssues;

    if (platform === "ANDROID") {
      if (issue.linkedProject === ANDROID_TEAMS.CLAM) {
        from = "team1";
      } else if (issue.linkedProject === ANDROID_TEAMS.DEV_WORKFLOW_INFRA) {
        from = "team2";
      } else {
        from = "others";
      }
    } else {
      if (issue.linkedProject === WEB_TEAMS.LEAP) {
        from = "team1";
      } else if (issue.linkedProject === WEB_TEAMS.CORE) {
        from = "team2";
      } else if (issue.linkedProject === WEB_TEAMS.DEV_WORKFLOW) {
        from = "team3";
      } else {
        from = "others";
      }
    }

    removeIssue(from, issue.issueNumber);
  };
}

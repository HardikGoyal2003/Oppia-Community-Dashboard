"use client";

import { getIssueBucket } from "@/lib/domain/issue-buckets";
import { useSession } from "next-auth/react";
import { useProjectIssuesStore } from "../store/project-issues.store";
import { CategorizedProjectIssues } from "../../../dashboard.types";
import type { Issue } from "@/lib/domain/issues.types";

import { archiveIssueForPlatform } from "../services/archived-issues-api.service";

export function useArchiveIssue() {
  const moveIssue = useProjectIssuesStore((state) => state.moveIssue);
  const { data: session } = useSession();

  return async (issue: Issue) => {
    const platform = session?.user?.platform;

    if (!platform) {
      console.error("User platform is undefined. Cannot archive issue.");
      return;
    }

    await archiveIssueForPlatform(issue, platform);

    const from: keyof CategorizedProjectIssues = getIssueBucket(
      platform,
      issue.linkedProject,
    );

    moveIssue(from, "archive", issue.issueNumber);
  };
}

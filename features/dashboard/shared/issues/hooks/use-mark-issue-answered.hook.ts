"use client";

import { getIssueBucket } from "@/lib/domain/issue-buckets";
import { useSession } from "next-auth/react";
import { useProjectIssuesStore } from "../store/project-issues.store";
import { CategorizedProjectIssues } from "../../../dashboard.types";
import type { Issue } from "@/lib/domain/issues.types";

export function useMarkIssueAsnwered() {
  const removeIssue = useProjectIssuesStore((state) => state.removeIssue);
  const { data: session } = useSession();

  return (issue: Issue) => {
    const platform = session?.user?.platform;

    const from: keyof CategorizedProjectIssues = getIssueBucket(
      platform === "ANDROID" ? "ANDROID" : "WEB",
      issue.linkedProject,
    );

    removeIssue(from, issue.issueNumber);
  };
}

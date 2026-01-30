"use server";

import { main } from "@/lib/github/scripts/github-issues.fetcher";
import { formatIssues } from "@/lib/github/service/ format-issues.service";
import { RawIssue, RawIssueNode } from "@/lib/github/github-fetcher.types";

export async function fetchGithubIssues(): Promise<{ issues: RawIssue[] }> {
  try {
    const issuesData: RawIssueNode[] = await main();
    return { issues: formatIssues(issuesData) };
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch GitHub issues");
  }
}

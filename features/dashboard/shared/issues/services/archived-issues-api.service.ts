import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/lib/domain/issues.types";

export async function getArchivedIssuesForPlatform(
  platform: ContributionPlatform,
): Promise<Issue[]> {
  const response = await fetch(`/api/archived-issues?platform=${platform}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch archived issues.");
  }

  const data = (await response.json()) as { archivedIssues: Issue[] };
  return data.archivedIssues;
}

export async function archiveIssueForPlatform(
  issue: Issue,
  platform: ContributionPlatform,
): Promise<void> {
  const response = await fetch("/api/archived-issues", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      issue,
      platform,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to archive issue.");
  }
}

export async function unarchiveIssueForPlatform(
  issueNumber: number,
  platform: ContributionPlatform,
): Promise<void> {
  const response = await fetch("/api/archived-issues", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      issueNumber,
      platform,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to unarchive issue.");
  }
}

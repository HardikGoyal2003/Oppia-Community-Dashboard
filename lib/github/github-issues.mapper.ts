import { GitHubIssue, GitHubIssueNode } from "./github.types";

/**
 * Validates that a GitHub issue node contains the fields required by the dashboard formatter.
 *
 * @param issue The raw GitHub issue node to validate.
 * @returns Nothing. Throws when required issue fields are missing.
 */
function assertFormattableIssue(issue: GitHubIssueNode): void {
  const latestComment = issue.comments.nodes[0];

  if (!latestComment?.createdAt) {
    throw new Error(
      `Issue ${issue.number} is missing the latest comment timestamp.`,
    );
  }
}

/**
 * Validates that a normalized GitHub issue matches the app-facing contract.
 *
 * @param issue The normalized GitHub issue to validate.
 * @returns Nothing. Throws when the normalized issue shape is invalid.
 */
function assertNormalizedGitHubIssue(issue: GitHubIssue): void {
  if (typeof issue.issueNumber !== "number") {
    throw new Error(
      "Normalized GitHub issue is missing a numeric issueNumber.",
    );
  }

  if (typeof issue.issueUrl !== "string" || !issue.issueUrl) {
    throw new Error("Normalized GitHub issue is missing issueUrl.");
  }

  if (typeof issue.issueTitle !== "string" || !issue.issueTitle) {
    throw new Error("Normalized GitHub issue is missing issueTitle.");
  }

  if (
    typeof issue.lastCommentCreatedAt !== "string" ||
    !issue.lastCommentCreatedAt
  ) {
    throw new Error("Normalized GitHub issue is missing lastCommentCreatedAt.");
  }

  if (typeof issue.linkedProject !== "string") {
    throw new Error("Normalized GitHub issue is missing linkedProject.");
  }
}

/**
 * Formats raw GitHub issue nodes into the dashboard issue shape.
 *
 * @param rawData The raw GitHub issue nodes returned from the GitHub fetcher.
 * @returns The normalized issue list expected by the dashboard.
 */
export function mapGitHubIssueNodes(rawData: GitHubIssueNode[]): GitHubIssue[] {
  return rawData.map((issue) => {
    assertFormattableIssue(issue);

    const normalizedIssue: GitHubIssue = {
      issueNumber: issue.number,
      issueUrl: issue.url,
      issueTitle: issue.title,
      lastCommentCreatedAt: issue.comments.nodes[0].createdAt,
      linkedProject: issue.projectsV2.nodes[0]?.title || "",
    };

    assertNormalizedGitHubIssue(normalizedIssue);

    return normalizedIssue;
  });
}

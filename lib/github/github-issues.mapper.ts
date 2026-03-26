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

  if (!issue.projectsV2.nodes[0]?.title) {
    throw new Error(`Issue ${issue.number} is missing a linked project title.`);
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

    return {
      issueNumber: issue.number,
      issueUrl: issue.url,
      issueTitle: issue.title,
      lastCommentCreatedAt: issue.comments.nodes[0].createdAt,
      linkedProject: issue.projectsV2.nodes[0].title,
    };
  });
}

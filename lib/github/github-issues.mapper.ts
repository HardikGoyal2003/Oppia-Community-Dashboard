import { LibMappingError } from "@/lib/lib.errors";
import { GitHubIssue, GitHubIssueNode } from "./github.types";

type IssueCommentNode = GitHubIssueNode["comments"]["nodes"][number];

const EXCLUDED_LAST_COMMENT_LOGINS = new Set([
  "github-actions",
  "github-actions[bot]",
]);

/**
 * Determines whether a comment author should be excluded from unanswered-issue
 * last-comment evaluation.
 *
 * @param login The comment author's GitHub login.
 * @returns True when the author is an excluded automated account.
 */
function isExcludedLastCommentAuthor(login: string | undefined): boolean {
  return (
    login !== undefined && EXCLUDED_LAST_COMMENT_LOGINS.has(login.toLowerCase())
  );
}

/**
 * Returns the most recent issue comment that should count for unanswered-issue
 * last-comment evaluation.
 *
 * @param issue The raw GitHub issue node.
 * @returns The effective latest comment, or null when none qualifies.
 */
export function getEffectiveLatestIssueComment(
  issue: GitHubIssueNode,
): IssueCommentNode | null {
  for (const comment of issue.comments.nodes) {
    if (!isExcludedLastCommentAuthor(comment.author?.login)) {
      return comment;
    }
  }

  return null;
}

/**
 * Validates that a GitHub issue node contains the fields required by the dashboard formatter.
 *
 * @param issue The raw GitHub issue node to validate.
 * @returns Nothing. Throws when required issue fields are missing.
 */
function assertFormattableIssue(issue: GitHubIssueNode): void {
  const latestComment = getEffectiveLatestIssueComment(issue);

  if (!latestComment?.createdAt) {
    throw new LibMappingError(
      "GitHubIssue",
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
    throw new LibMappingError(
      "GitHubIssue",
      "Normalized GitHub issue is missing a numeric issueNumber.",
    );
  }

  if (typeof issue.issueUrl !== "string" || !issue.issueUrl) {
    throw new LibMappingError(
      "GitHubIssue",
      "Normalized GitHub issue is missing issueUrl.",
    );
  }

  if (typeof issue.issueTitle !== "string" || !issue.issueTitle) {
    throw new LibMappingError(
      "GitHubIssue",
      "Normalized GitHub issue is missing issueTitle.",
    );
  }

  if (
    typeof issue.lastCommentCreatedAt !== "string" ||
    !issue.lastCommentCreatedAt
  ) {
    throw new LibMappingError(
      "GitHubIssue",
      "Normalized GitHub issue is missing lastCommentCreatedAt.",
    );
  }

  if (typeof issue.linkedProject !== "string") {
    throw new LibMappingError(
      "GitHubIssue",
      "Normalized GitHub issue is missing linkedProject.",
    );
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
    const latestComment = getEffectiveLatestIssueComment(issue)!;

    const normalizedIssue: GitHubIssue = {
      issueNumber: issue.number,
      issueUrl: issue.url,
      issueTitle: issue.title,
      lastCommentCreatedAt: latestComment.createdAt,
      linkedProject: issue.projectsV2.nodes[0]?.title || "",
    };

    assertNormalizedGitHubIssue(normalizedIssue);

    return normalizedIssue;
  });
}

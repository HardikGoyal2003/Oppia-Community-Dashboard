import { GitHubGoodFirstIssue, GitHubGoodFirstIssueNode } from "./github.types";

/**
 * Validates that a raw GitHub GFI node contains the fields required by the dashboard.
 *
 * @param issue The raw GitHub GFI node to validate.
 * @returns Nothing. Throws when required issue fields are missing.
 */
function assertFormattableGoodFirstIssue(
  issue: GitHubGoodFirstIssueNode,
): void {
  if (typeof issue.number !== "number") {
    throw new Error("GitHub GFI node is missing a numeric issue number.");
  }

  if (typeof issue.title !== "string" || !issue.title) {
    throw new Error(`GitHub GFI ${issue.number} is missing a title.`);
  }

  if (typeof issue.url !== "string" || !issue.url) {
    throw new Error(`GitHub GFI ${issue.number} is missing a URL.`);
  }

  if (!Array.isArray(issue.labels?.nodes)) {
    throw new Error(`GitHub GFI ${issue.number} is missing label data.`);
  }

  if (!Array.isArray(issue.projectsV2?.nodes)) {
    throw new Error(
      `GitHub GFI ${issue.number} is missing linked project data.`,
    );
  }
}

/**
 * Formats raw GitHub GFI nodes into the dashboard classification shape.
 *
 * @param rawData The raw GFI nodes returned from the GitHub fetcher.
 * @returns The normalized good first issue list.
 */
export function mapGitHubGoodFirstIssueNodes(
  rawData: GitHubGoodFirstIssueNode[],
): GitHubGoodFirstIssue[] {
  return rawData.map((issue) => {
    assertFormattableGoodFirstIssue(issue);

    return {
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueUrl: issue.url,
      labels: issue.labels.nodes.map((label) => label.name),
      linkedProject: issue.projectsV2.nodes[0]?.title || "",
    };
  });
}
